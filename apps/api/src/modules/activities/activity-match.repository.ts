import { Injectable } from '@nestjs/common';

import type { MatchScoreRecordStatus, MatchSide, MatchStage } from '@ntr/shared';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { matchInclude, type MatchWithPlayers } from './match-mapper';

export type MatchCreateInput = Omit<Prisma.ActivityMatchUncheckedCreateInput, 'activityId'>;

export interface ScoreSettleData {
  playerAGames: number;
  playerBGames: number;
  playerATiebreakPoints: number | null;
  playerBTiebreakPoints: number | null;
  winnerId: string;
  actorId?: string | null;
  actorSide?: MatchSide | null;
  confirmationState: 'NOT_REQUIRED' | 'PENDING_CONFIRM';
  reason?: string;
}

export interface ScoreSnapshot {
  playerAGames: number | null;
  playerBGames: number | null;
  playerATiebreakPoints: number | null;
  playerBTiebreakPoints: number | null;
}

export interface MatchAuditInput {
  activityId: string;
  matchId: string;
  actorId?: string | null;
  action: 'RECORD' | 'UPDATE' | 'MARK_UNPLAYED' | 'CONFIRM' | 'DISPUTE' | 'ARBITRATE';
  recordStatusBefore: MatchScoreRecordStatus | null;
  recordStatusAfter: MatchScoreRecordStatus;
  scoreBefore: ScoreSnapshot;
  scoreAfter: ScoreSnapshot;
  reason?: string | null;
}

@Injectable()
export class ActivityMatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  clearSchedule(activityId: string) {
    return this.prisma.$transaction([
      this.prisma.activityMatch.deleteMany({ where: { activityId } }),
      this.prisma.activityRound.deleteMany({ where: { activityId } }),
    ]);
  }

  createRound(activityId: string, roundNumber: number, matches: MatchCreateInput[]) {
    return this.prisma.$transaction(async (transaction) => {
      const round = await transaction.activityRound.create({
        data: { activityId, roundNumber },
      });
      await transaction.activityMatch.createMany({
        data: matches.map((match) => ({ ...match, activityId, roundId: round.id })),
      });
      return round;
    });
  }

  /** 批量创建无轮次的淘汰赛/三四名对局（roundId 为空）。 */
  createKnockoutMatches(activityId: string, matches: MatchCreateInput[]) {
    return this.prisma.activityMatch.createMany({
      data: matches.map((match) => ({ ...match, activityId })),
    });
  }

  findRoundsWithMatches(activityId: string) {
    return this.prisma.activityRound.findMany({
      where: { activityId },
      orderBy: { roundNumber: 'asc' },
      include: { matches: { orderBy: { courtName: 'asc' }, include: matchInclude } },
    });
  }

  findKnockoutMatches(activityId: string): Promise<MatchWithPlayers[]> {
    return this.prisma.activityMatch.findMany({
      where: { activityId, roundId: null },
      orderBy: [{ stage: 'asc' }, { bracketSlot: 'asc' }],
      include: matchInclude,
    });
  }

  findMatchById(id: string): Promise<MatchWithPlayers | null> {
    return this.prisma.activityMatch.findUnique({ where: { id }, include: matchInclude });
  }

  findMatchByStageSlot(
    activityId: string,
    stage: MatchStage,
    bracketSlot: number,
  ): Promise<MatchWithPlayers | null> {
    return this.prisma.activityMatch.findFirst({
      where: { activityId, stage, bracketSlot },
      include: matchInclude,
    });
  }

  findCompletedMatchesIn(activityId: string, where?: Prisma.ActivityMatchWhereInput) {
    return this.prisma.activityMatch.findMany({
      where: { activityId, recordStatus: 'COMPLETED', ...where },
      include: {
        playerA: { select: { id: true, participantName: true, gender: true, userId: true } },
        playerB: { select: { id: true, participantName: true, gender: true, userId: true } },
      },
    });
  }

  /** 判断活动是否存在已生成的对局。 */
  async hasSchedule(activityId: string): Promise<boolean> {
    const count = await this.prisma.activityMatch.count({ where: { activityId } });
    return count > 0;
  }

  async hasCompleted(activityId: string): Promise<boolean> {
    const count = await this.prisma.activityMatch.count({
      where: { activityId, recordStatus: 'COMPLETED' },
    });
    return count > 0;
  }

  settleScore(matchId: string, data: ScoreSettleData) {
    return this.prisma.activityMatch.update({
      where: { id: matchId },
      data: {
        playerAGames: data.playerAGames,
        playerBGames: data.playerBGames,
        playerATiebreakPoints: data.playerATiebreakPoints,
        playerBTiebreakPoints: data.playerBTiebreakPoints,
        winnerId: data.winnerId,
        recordStatus: 'COMPLETED',
        confirmationState: data.confirmationState,
        scoreUpdatedAt: new Date(),
        scoreSubmittedById: data.actorId ?? null,
        scoreSubmittedSide: data.actorSide ?? null,
      },
      include: matchInclude,
    });
  }

  markUnplayed(matchId: string) {
    return this.prisma.activityMatch.update({
      where: { id: matchId },
      data: {
        playerAGames: null,
        playerBGames: null,
        playerATiebreakPoints: null,
        playerBTiebreakPoints: null,
        winnerId: null,
        recordStatus: 'UNPLAYED',
        confirmationState: 'NOT_REQUIRED',
        scoreUpdatedAt: null,
        scoreSubmittedById: null,
        scoreSubmittedSide: null,
      },
      include: matchInclude,
    });
  }

  setConfirmationState(matchId: string, state: 'CONFIRMED' | 'DISPUTED') {
    return this.prisma.activityMatch.update({
      where: { id: matchId },
      data: { confirmationState: state },
      include: matchInclude,
    });
  }

  createConfirmation(matchId: string, userId: string, scoreUpdatedAt: Date) {
    return this.prisma.activityMatchScoreConfirmation.create({
      data: { matchId, userId, scoreUpdatedAt },
    });
  }

  /** 淘汰赛对局结算后，将胜者填入上一阶段对应空位。 */
  fillBracketSlot(matchId: string, side: MatchSide, signupId: string) {
    return this.prisma.activityMatch.update({
      where: { id: matchId },
      data: side === 'A' ? { playerAId: signupId } : { playerBId: signupId },
    });
  }

  createAudit(audit: MatchAuditInput) {
    return this.prisma.activityMatchScoreAudit.create({
      data: {
        activityId: audit.activityId,
        matchId: audit.matchId,
        actorId: audit.actorId ?? null,
        action: audit.action,
        recordStatusBefore: audit.recordStatusBefore,
        recordStatusAfter: audit.recordStatusAfter,
        playerAGamesBefore: audit.scoreBefore.playerAGames,
        playerBGamesBefore: audit.scoreBefore.playerBGames,
        playerATiebreakPointsBefore: audit.scoreBefore.playerATiebreakPoints,
        playerBTiebreakPointsBefore: audit.scoreBefore.playerBTiebreakPoints,
        playerAGamesAfter: audit.scoreAfter.playerAGames,
        playerBGamesAfter: audit.scoreAfter.playerBGames,
        playerATiebreakPointsAfter: audit.scoreAfter.playerATiebreakPoints,
        playerBTiebreakPointsAfter: audit.scoreAfter.playerBTiebreakPoints,
        reason: audit.reason ?? null,
      },
    });
  }
}
