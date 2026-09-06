import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  getMatchRule,
  getSinglesScoreError,
  normalizeSinglesScore,
  type ActivityMatchResponse,
  type MatchSide,
} from '@ntr/shared';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { Activity } from '../../generated/prisma/client';
import { ActivityRepository } from './activity.repository';
import { ActivityMatchRepository } from './activity-match.repository';
import { ActivityStandingsService } from './activity-standings.service';
import { mapActivityMatch, type MatchWithPlayers } from './match-mapper';
import { ArbitrateMatchScoreDto } from './dto/arbitrate-match-score.dto';
import { SaveMatchScoreDto } from './dto/save-match-score.dto';

@Injectable()
export class ActivityScoreService {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly matchesRepo: ActivityMatchRepository,
    private readonly standings: ActivityStandingsService,
  ) {}

  async saveScore(
    actor: AuthenticatedUser,
    activityId: string,
    matchId: string,
    dto: SaveMatchScoreDto,
  ): Promise<ActivityMatchResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    const match = await this.loadMatch(activityId, matchId);
    this.assertPlayerOrAdmin(actor, match);

    if (this.isSettled(match)) {
      throw new ConflictException('该场比分已确认，如需修改请联系管理员');
    }

    const normalized = this.validateScore(activity, match, dto);
    const isAdmin = actor.role === 'ADMIN';
    const actorSide = this.resolveActorSide(match, actor);
    const opponentHasAccount = this.opponentHasAccount(match, actorSide);
    const confirmationState = isAdmin || !opponentHasAccount ? 'NOT_REQUIRED' : 'PENDING_CONFIRM';

    const before = this.snapshot(match);
    const settled = await this.matchesRepo.settleScore(matchId, {
      playerAGames: normalized.gamesA,
      playerBGames: normalized.gamesB,
      playerATiebreakPoints: normalized.tiebreakA,
      playerBTiebreakPoints: normalized.tiebreakB,
      winnerId: normalized.winnerId,
      actorId: actor.id,
      actorSide,
      confirmationState,
    });
    await this.matchesRepo.createAudit({
      activityId,
      matchId,
      actorId: actor.id,
      action: before.recordStatus === 'COMPLETED' ? 'UPDATE' : 'RECORD',
      recordStatusBefore: before.recordStatus,
      recordStatusAfter: 'COMPLETED',
      scoreBefore: before.score,
      scoreAfter: this.normalizedSnapshot(normalized),
    });

    if (confirmationState === 'NOT_REQUIRED') {
      await this.standings.advanceFromMatch(activityId, settled);
    }
    return mapActivityMatch(settled, actor.id);
  }

  async confirmScore(
    actor: AuthenticatedUser,
    activityId: string,
    matchId: string,
  ): Promise<ActivityMatchResponse> {
    const match = await this.loadMatch(activityId, matchId);
    if (match.recordStatus !== 'COMPLETED' || match.confirmationState !== 'PENDING_CONFIRM') {
      throw new ConflictException('当前状态无需确认');
    }
    const submitterSide = match.scoreSubmittedSide;
    if (!submitterSide || match.scoreUpdatedAt == null) {
      throw new ConflictException('该比分缺少提交方信息，请联系管理员');
    }
    const opponentSide: MatchSide = submitterSide === 'A' ? 'B' : 'A';
    const opponent = opponentSide === 'A' ? match.playerA : match.playerB;
    if (!opponent || opponent.userId !== actor.id) {
      throw new ForbiddenException('仅对手可确认该场比分');
    }

    await this.matchesRepo.createConfirmation(matchId, actor.id, match.scoreUpdatedAt);
    const confirmed = await this.matchesRepo.setConfirmationState(matchId, 'CONFIRMED');
    await this.matchesRepo.createAudit({
      activityId,
      matchId,
      actorId: actor.id,
      action: 'CONFIRM',
      recordStatusBefore: 'COMPLETED',
      recordStatusAfter: 'COMPLETED',
      scoreBefore: this.snapshot(match).score,
      scoreAfter: this.snapshot(match).score,
    });
    await this.standings.advanceFromMatch(activityId, confirmed);
    return mapActivityMatch(confirmed, actor.id);
  }

  async disputeScore(
    actor: AuthenticatedUser,
    activityId: string,
    matchId: string,
    reason: string,
  ): Promise<ActivityMatchResponse> {
    const match = await this.loadMatch(activityId, matchId);
    this.assertPlayerOrAdmin(actor, match);
    if (match.recordStatus !== 'COMPLETED') {
      throw new ConflictException('仅可对已录入的比分提出异议');
    }
    const before = this.snapshot(match);
    const disputed = await this.matchesRepo.setConfirmationState(matchId, 'DISPUTED');
    await this.matchesRepo.createAudit({
      activityId,
      matchId,
      actorId: actor.id,
      action: 'DISPUTE',
      recordStatusBefore: before.recordStatus,
      recordStatusAfter: before.recordStatus,
      scoreBefore: before.score,
      scoreAfter: before.score,
      reason,
    });
    return mapActivityMatch(disputed, actor.id);
  }

  async arbitrate(
    actor: AuthenticatedUser,
    activityId: string,
    matchId: string,
    dto: ArbitrateMatchScoreDto,
  ): Promise<ActivityMatchResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    const match = await this.loadMatch(activityId, matchId);
    if (actor.role !== 'ADMIN') throw new ForbiddenException('仅管理员可仲裁比分');

    const normalized = this.validateScore(activity, match, dto);
    const before = this.snapshot(match);
    const settled = await this.matchesRepo.settleScore(matchId, {
      playerAGames: normalized.gamesA,
      playerBGames: normalized.gamesB,
      playerATiebreakPoints: normalized.tiebreakA,
      playerBTiebreakPoints: normalized.tiebreakB,
      winnerId: normalized.winnerId,
      actorId: actor.id,
      actorSide: match.scoreSubmittedSide ?? null,
      confirmationState: 'NOT_REQUIRED',
    });
    await this.matchesRepo.createAudit({
      activityId,
      matchId,
      actorId: actor.id,
      action: 'ARBITRATE',
      recordStatusBefore: before.recordStatus,
      recordStatusAfter: 'COMPLETED',
      scoreBefore: before.score,
      scoreAfter: this.normalizedSnapshot(normalized),
      reason: dto.reason,
    });
    await this.standings.advanceFromMatch(activityId, settled);
    return mapActivityMatch(settled, actor.id);
  }

  async markUnplayed(
    actor: AuthenticatedUser,
    activityId: string,
    matchId: string,
    reason?: string,
  ): Promise<ActivityMatchResponse> {
    const match = await this.loadMatch(activityId, matchId);
    const before = this.snapshot(match);
    const unplayed = await this.matchesRepo.markUnplayed(matchId);
    await this.matchesRepo.createAudit({
      activityId,
      matchId,
      actorId: actor.id,
      action: 'MARK_UNPLAYED',
      recordStatusBefore: before.recordStatus,
      recordStatusAfter: 'UNPLAYED',
      scoreBefore: before.score,
      scoreAfter: this.snapshot(unplayed).score,
      reason,
    });
    return mapActivityMatch(unplayed, actor.id);
  }

  private async loadMatch(activityId: string, matchId: string): Promise<MatchWithPlayers> {
    const match = await this.matchesRepo.findMatchById(matchId);
    if (!match || match.activityId !== activityId) throw new NotFoundException('对局不存在');
    return match;
  }

  private assertPlayerOrAdmin(actor: AuthenticatedUser, match: MatchWithPlayers): void {
    const isAdmin = actor.role === 'ADMIN';
    const isPlayer = match.playerA?.userId === actor.id || match.playerB?.userId === actor.id;
    if (!isAdmin && !isPlayer) {
      throw new ForbiddenException('仅对阵双方或管理员可操作');
    }
  }

  private isSettled(match: MatchWithPlayers): boolean {
    return (
      match.recordStatus === 'COMPLETED' &&
      (match.confirmationState === 'CONFIRMED' ||
        match.confirmationState === 'NOT_REQUIRED' ||
        match.confirmationState === 'PENDING_CONFIRM')
    );
  }

  private resolveActorSide(match: MatchWithPlayers, actor: AuthenticatedUser): MatchSide {
    if (actor.role === 'ADMIN') return match.scoreSubmittedSide ?? 'A';
    if (match.playerA?.userId === actor.id) return 'A';
    if (match.playerB?.userId === actor.id) return 'B';
    return 'A';
  }

  private opponentHasAccount(match: MatchWithPlayers, actorSide: MatchSide): boolean {
    const opponent = actorSide === 'A' ? match.playerB : match.playerA;
    return opponent?.userId != null;
  }

  private validateScore(
    activity: Activity,
    match: MatchWithPlayers,
    dto: SaveMatchScoreDto | ArbitrateMatchScoreDto,
  ) {
    const rule = getMatchRule(activity.matchRuleCode);
    const result = getSinglesScoreError(
      rule,
      dto.playerAGames,
      dto.playerBGames,
      dto.playerATiebreakPoints,
      dto.playerBTiebreakPoints,
    );
    if (!result.ok) throw new BadRequestException(result.message);
    if (!result.completed) {
      throw new BadRequestException('比分尚未分出胜负，请输入完整终局比分');
    }
    const normalized = normalizeSinglesScore(
      dto.playerAGames,
      dto.playerBGames,
      dto.playerATiebreakPoints,
      dto.playerBTiebreakPoints,
    );
    const winnerSignupId = result.winnerSide === 'A' ? match.playerAId : match.playerBId;
    if (!winnerSignupId) {
      throw new BadRequestException('胜方尚未确定参赛选手');
    }
    return { ...normalized, winnerId: winnerSignupId };
  }

  private snapshot(match: MatchWithPlayers) {
    return {
      recordStatus: match.recordStatus,
      score: {
        playerAGames: match.playerAGames,
        playerBGames: match.playerBGames,
        playerATiebreakPoints: match.playerATiebreakPoints,
        playerBTiebreakPoints: match.playerBTiebreakPoints,
      },
    };
  }

  private normalizedSnapshot(normalized: ReturnType<ActivityScoreService['validateScore']>) {
    return {
      playerAGames: normalized.gamesA,
      playerBGames: normalized.gamesB,
      playerATiebreakPoints: normalized.tiebreakA,
      playerBTiebreakPoints: normalized.tiebreakB,
    };
  }
}
