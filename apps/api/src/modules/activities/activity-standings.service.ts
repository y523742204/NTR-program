import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  Activity,
  MatchScoreRecordStatus,
  ParticipantGender,
} from '../../generated/prisma/client';
import {
  ACTIVITY_MODES,
  KNOCKOUT_STAGE_ORDER,
  MATCH_STAGES,
  buildKnockoutPairs,
  buildQualifierSeeds,
  getBracketParent,
  getKnockoutStageDepth,
  getKnockoutStages,
  type ActivityMatchResponse,
  type GroupStandingsResponse,
  type KnockoutBracketResponse,
  type MatchStage,
  type RoundRobinStandingsResponse,
  type StandingRowResponse,
} from '@ntr/shared';

import { ActivityRepository } from './activity.repository';
import { ActivitySignupRepository } from './activity-signup.repository';
import { ActivityMatchRepository } from './activity-match.repository';
import { mapActivityMatch, type MatchWithPlayers } from './match-mapper';

interface StandingMatch {
  playerAId: string | null;
  playerBId: string | null;
  winnerId: string | null;
  playerAGames: number | null;
  playerBGames: number | null;
  playerA: {
    id: string;
    participantName: string;
    gender: RowSeed['gender'];
    userId: string | null;
  } | null;
  playerB: {
    id: string;
    participantName: string;
    gender: RowSeed['gender'];
    userId: string | null;
  } | null;
  recordStatus: MatchScoreRecordStatus;
  groupNumber: number | null;
}

interface RowSeed {
  id: string;
  participantName: string;
  gender: ParticipantGender | null;
  userId: string | null;
  avatarUrl: string | null;
}

interface StandingRowInternal {
  signupId: string;
  participantName: string;
  avatarUrl: string | null;
  gender: RowSeed['gender'];
  userId: string | null;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
}

@Injectable()
export class ActivityStandingsService {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly signupsRepo: ActivitySignupRepository,
    private readonly matchesRepo: ActivityMatchRepository,
  ) {}

  async getStandings(
    activityId: string,
    meUserId?: string,
  ): Promise<RoundRobinStandingsResponse | GroupStandingsResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.mode === ACTIVITY_MODES.ROUND_ROBIN) {
      return this.getRoundRobinStandings(activityId, meUserId);
    }
    return this.getGroupStandings(activityId, meUserId);
  }

  async getRoundRobinStandings(
    activityId: string,
    meUserId?: string,
  ): Promise<RoundRobinStandingsResponse> {
    const signups = await this.signupsRepo.findByOpen(activityId);
    const completed = await this.matchesRepo.findCompletedMatchesIn(activityId);
    const rows = this.buildStandingRows(
      signups.map((signup) => ({
        id: signup.id,
        participantName: signup.participantName,
        gender: signup.gender,
        userId: signup.userId,
        avatarUrl: signup.user?.avatarUrl ?? null,
      })),
      completed,
      meUserId,
    );
    const { settled, total } = await this.scheduleSettledState(activityId);
    return { rows, completed: total > 0 && settled === total };
  }

  async getGroupStandings(activityId: string, meUserId?: string): Promise<GroupStandingsResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.mode !== ACTIVITY_MODES.GROUP_KNOCKOUT) {
      throw new BadRequestException('当前活动不是小组赛模式');
    }
    const qualifyPerGroup = activity.qualifyPerGroup ?? 1;
    const groupMatches = await this.allGroupMatches(activityId);

    const groupOfSignup = new Map<string, number>();
    for (const match of groupMatches) {
      if (match.groupNumber == null) continue;
      if (match.playerA) groupOfSignup.set(match.playerA.id, match.groupNumber);
      if (match.playerB) groupOfSignup.set(match.playerB.id, match.groupNumber);
    }

    const signups = await this.signupsRepo.findByOpen(activityId);
    const playersByGroup = new Map<number, RowSeed[]>();
    for (const signup of signups) {
      const groupNumber = groupOfSignup.get(signup.id);
      if (groupNumber == null) continue;
      const list = playersByGroup.get(groupNumber) ?? [];
      list.push({
        id: signup.id,
        participantName: signup.participantName,
        gender: signup.gender,
        userId: signup.userId,
        avatarUrl: signup.user?.avatarUrl ?? null,
      });
      playersByGroup.set(groupNumber, list);
    }

    const groups = [...playersByGroup.keys()]
      .sort((a, b) => a - b)
      .map((groupNumber) => {
        const players = playersByGroup.get(groupNumber) ?? [];
        const completed = completedMatchesInGroup(groupMatches, groupNumber);
        const rows = this.buildStandingRows(players, completed, meUserId);
        rows.forEach((row, index) => {
          row.qualified = index < qualifyPerGroup;
        });
        return { groupNumber, rows };
      });

    return { groups };
  }

  async getBracket(activityId: string, meUserId?: string): Promise<KnockoutBracketResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.mode !== ACTIVITY_MODES.GROUP_KNOCKOUT) {
      throw new BadRequestException('当前活动不是小组赛+淘汰赛模式');
    }
    await this.ensureKnockoutSeeded(activity);

    const knockout = await this.matchesRepo.findKnockoutMatches(activityId);
    const thirdPlaceRow = knockout.find((match) => match.stage === MATCH_STAGES.THIRD_PLACE);
    const stageRows = knockout.filter((match) => match.stage !== MATCH_STAGES.THIRD_PLACE);

    const byStage = new Map<MatchStage, MatchWithPlayers[]>();
    for (const match of stageRows) {
      const stage = match.stage ?? MATCH_STAGES.FINAL;
      const list = byStage.get(stage) ?? [];
      list.push(match);
      byStage.set(stage, list);
    }

    const stages = [...byStage.keys()]
      .sort((a, b) => getKnockoutStageDepth(b) - getKnockoutStageDepth(a))
      .map((stage) => ({
        stage,
        matches: (byStage.get(stage) ?? [])
          .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0))
          .map((match) => mapActivityMatch(match, meUserId)),
      }));

    const finalMatch = byStage.get(MATCH_STAGES.FINAL)?.[0];
    let champion: ActivityMatchResponse['playerA'] = null;
    let runnerUp: ActivityMatchResponse['playerA'] = null;
    if (finalMatch && finalMatch.recordStatus === 'COMPLETED' && finalMatch.winnerId) {
      const mapped = mapActivityMatch(finalMatch, meUserId);
      champion =
        [mapped.playerA, mapped.playerB].find(
          (player) => player?.signupId === finalMatch.winnerId,
        ) ?? null;
      runnerUp =
        [mapped.playerA, mapped.playerB].find(
          (player) => player?.signupId !== finalMatch.winnerId,
        ) ?? null;
    }

    return {
      stages,
      thirdPlace: thirdPlaceRow ? mapActivityMatch(thirdPlaceRow, meUserId) : null,
      champion,
      runnerUp,
    };
  }

  /** 小组赛全部结束后按名次自动落位淘汰赛首轮对阵。 */
  async ensureKnockoutSeeded(activity: ActivityInternal): Promise<void> {
    if (activity.mode !== ACTIVITY_MODES.GROUP_KNOCKOUT) return;
    const groupCount = activity.groupCount;
    const qualifyPerGroup = activity.qualifyPerGroup;
    if (!groupCount || !qualifyPerGroup) return;
    const size = groupCount * qualifyPerGroup;
    const initialStage = getKnockoutStages(size)[0];

    const knockout = await this.matchesRepo.findKnockoutMatches(activity.id);
    const initialMatches = knockout.filter((match) => match.stage === initialStage);
    if (initialMatches.some((match) => match.playerAId || match.playerBId)) return;

    const groupMatches = await this.allGroupMatches(activity.id);
    if (groupMatches.some((match) => match.recordStatus === 'PENDING')) return;

    const groupOfSignup = new Map<string, number>();
    for (const match of groupMatches) {
      if (match.groupNumber == null) continue;
      if (match.playerA) groupOfSignup.set(match.playerA.id, match.groupNumber);
      if (match.playerB) groupOfSignup.set(match.playerB.id, match.groupNumber);
    }
    const signups = await this.signupsRepo.findByOpen(activity.id);
    const groupNumbers = [...new Set(groupOfSignup.values())].sort((a, b) => a - b);
    const qualifiedGroupRows = groupNumbers.map((groupNumber) => {
      const players = signups
        .filter((signup) => groupOfSignup.get(signup.id) === groupNumber)
        .map((signup) => ({
          id: signup.id,
          participantName: signup.participantName,
          gender: signup.gender,
          userId: signup.userId,
          avatarUrl: signup.user?.avatarUrl ?? null,
        }));
      const rows = this.buildStandingRows(
        players,
        completedMatchesInGroup(groupMatches, groupNumber),
      );
      return rows.slice(0, qualifyPerGroup).map((row) => row.signupId);
    });

    const seeds = buildQualifierSeeds(
      qualifiedGroupRows.map((ids) => ids.map((signupId) => ({ signupId }))),
      qualifyPerGroup,
    );
    const pairs = buildKnockoutPairs(seeds);
    for (const pair of pairs) {
      const target = initialMatches.find((match) => match.bracketSlot === pair.slot);
      if (!target || !pair.seedA) continue;
      await this.matchesRepo.fillBracketSlot(target.id, 'A', pair.seedA);
      if (pair.seedB && pair.seedB !== pair.seedA) {
        await this.matchesRepo.fillBracketSlot(target.id, 'B', pair.seedB);
      }
    }
  }

  /** 淘汰赛对局结算后推进对阵。 */
  async advanceFromMatch(activityId: string, match: MatchWithPlayers): Promise<void> {
    const stage = match.stage;
    if (!stage || getKnockoutStageDepth(stage) < 0 || !match.winnerId) return;
    if (stage === MATCH_STAGES.FINAL || stage === MATCH_STAGES.THIRD_PLACE) return;

    if (stage === MATCH_STAGES.SEMI_FINAL) {
      const { side } = getBracketParent(1, match.bracketSlot ?? 0);
      const finalMatch = await this.matchesRepo.findMatchByStageSlot(
        activityId,
        MATCH_STAGES.FINAL,
        0,
      );
      if (finalMatch) {
        await this.matchesRepo.fillBracketSlot(finalMatch.id, side, match.winnerId);
      }
      await this.fillThirdPlace(activityId, match);
      return;
    }

    const depth = getKnockoutStageDepth(stage);
    const { parentSlot, side } = getBracketParent(depth, match.bracketSlot ?? 0);
    const parentStage = KNOCKOUT_STAGE_ORDER[KNOCKOUT_STAGE_ORDER.indexOf(stage) + 1];
    if (!parentStage) return;
    const parent = await this.matchesRepo.findMatchByStageSlot(activityId, parentStage, parentSlot);
    if (parent) {
      await this.matchesRepo.fillBracketSlot(parent.id, side, match.winnerId);
    }
  }

  private async fillThirdPlace(activityId: string, settledSemi: MatchWithPlayers) {
    const sibling = await this.matchesRepo.findMatchByStageSlot(
      activityId,
      MATCH_STAGES.SEMI_FINAL,
      (settledSemi.bracketSlot ?? 0) ^ 1,
    );
    const thirdPlace = await this.matchesRepo.findMatchByStageSlot(
      activityId,
      MATCH_STAGES.THIRD_PLACE,
      0,
    );
    if (!thirdPlace || !sibling || sibling.recordStatus !== 'COMPLETED' || !sibling.winnerId)
      return;

    const loserOf = (match: MatchWithPlayers): string | null => {
      if (!match.winnerId) return null;
      return match.playerAId === match.winnerId ? match.playerBId : match.playerAId;
    };
    const loserA = loserOf(settledSemi);
    const loserB = loserOf(sibling);
    if (!loserA || !loserB) return;
    await this.matchesRepo.fillBracketSlot(thirdPlace.id, 'A', loserA);
    await this.matchesRepo.fillBracketSlot(thirdPlace.id, 'B', loserB);
  }

  private async allGroupMatches(activityId: string) {
    const rounds = await this.matchesRepo.findRoundsWithMatches(activityId);
    return rounds.flatMap((round) =>
      round.matches.filter(
        (match) => match.stage === MATCH_STAGES.GROUP && match.groupNumber != null,
      ),
    );
  }

  private async scheduleSettledState(activityId: string) {
    const rounds = await this.matchesRepo.findRoundsWithMatches(activityId);
    const all = rounds.flatMap((round) => round.matches);
    const settled = all.filter((match) => match.recordStatus !== 'PENDING').length;
    return { settled, total: all.length };
  }

  private buildStandingRows(
    players: RowSeed[],
    completed: StandingMatch[],
    meUserId?: string,
  ): StandingRowResponse[] {
    const rows = new Map<string, StandingRowInternal>();
    for (const player of players) {
      rows.set(player.id, {
        signupId: player.id,
        participantName: player.participantName,
        avatarUrl: player.avatarUrl,
        gender: player.gender,
        userId: player.userId,
        played: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
      });
    }
    for (const match of completed) {
      const a = match.playerA;
      const b = match.playerB;
      if (!a || !b || !match.winnerId) continue;
      const rowA = rows.get(a.id);
      const rowB = rows.get(b.id);
      if (!rowA || !rowB) continue;
      const gamesA = match.playerAGames ?? 0;
      const gamesB = match.playerBGames ?? 0;
      rowA.played += 1;
      rowB.played += 1;
      rowA.gamesWon += gamesA;
      rowA.gamesLost += gamesB;
      rowB.gamesWon += gamesB;
      rowB.gamesLost += gamesA;
      if (match.winnerId === a.id) {
        rowA.wins += 1;
        rowB.losses += 1;
      } else {
        rowB.wins += 1;
        rowA.losses += 1;
      }
    }
    return [...rows.values()]
      .sort((a, b) => {
        const gameDiff = (item: StandingRowInternal) => item.gamesWon - item.gamesLost;
        return (
          b.wins - a.wins ||
          gameDiff(b) - gameDiff(a) ||
          b.gamesWon - a.gamesWon ||
          a.participantName.localeCompare(b.participantName)
        );
      })
      .map((row, index) => ({
        signupId: row.signupId,
        participantName: row.participantName,
        avatarUrl: row.avatarUrl,
        gender: row.gender,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
        gameDiff: row.gamesWon - row.gamesLost,
        rank: index + 1,
        qualified: false,
        isMe: Boolean(meUserId && row.userId === meUserId),
      }));
  }
}

function completedMatchesInGroup(matches: StandingMatch[], groupNumber: number) {
  return matches.filter(
    (match) =>
      match.groupNumber === groupNumber &&
      match.recordStatus === 'COMPLETED' &&
      match.winnerId != null,
  );
}

type ActivityInternal = Activity;
