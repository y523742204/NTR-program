import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  MySignupListResponse,
  PlayerLevel,
  PublicUserProfileResponse,
  UserMatchItemResponse,
  UserRecordsResponse,
} from '@ntr/shared';

import { PrismaService } from '../../database/prisma.service';
import { ActivityMatchRepository } from './activity-match.repository';

type UserMatchRow = Awaited<ReturnType<ActivityMatchRepository['findMatchesByUser']>>[number];

@Injectable()
export class MyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matches: ActivityMatchRepository,
  ) {}

  /** 任意用户的公开资料与历史对局（含胜负汇总）。 */
  async getUserRecords(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserRecordsResponse> {
    const profile = await this.getPublicProfile(userId);
    const [rows, total, played, wins] = await Promise.all([
      this.matches.findMatchesByUser(userId, page, pageSize),
      this.matches.countMatchesByUser(userId),
      this.matches.countMatchesByUser(userId, true),
      this.matches.countWinsByUser(userId),
    ]);
    const losses = Math.max(0, played - wins);
    return {
      profile,
      summary: {
        played,
        wins,
        losses,
        winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
      },
      items: rows.map((match) => this.mapMatch(match, userId)),
      total,
      page,
      pageSize,
    };
  }

  async mySignups(
    actor: { id: string },
    page: number,
    pageSize: number,
  ): Promise<MySignupListResponse> {
    const where = { userId: actor.id };
    const [signups, total] = await Promise.all([
      this.prisma.activitySignup.findMany({
        where,
        include: {
          user: { select: { avatarUrl: true } },
          activity: {
            select: {
              id: true,
              title: true,
              mode: true,
              status: true,
              startAt: true,
              endAt: true,
              locationName: true,
              schedulePublishedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activitySignup.count({ where }),
    ]);
    const items = signups.map((signup) => ({
      signupId: signup.id,
      activityId: signup.activityId,
      activityTitle: signup.activity.title,
      mode: signup.activity.mode,
      status: signup.activity.status,
      signupStatus: signup.status,
      startAt: signup.activity.startAt.toISOString(),
      endAt: signup.activity.endAt.toISOString(),
      locationName: signup.activity.locationName,
      schedulePublished: Boolean(signup.activity.schedulePublishedAt),
    }));
    return { items, total, page, pageSize };
  }

  private async getPublicProfile(userId: string): Promise<PublicUserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true, level: true, gender: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      userId: user.id,
      name: user.name?.trim() || '未知选手',
      avatarUrl: user.avatarUrl,
      level: (user.level as PlayerLevel | null) ?? null,
      gender: user.gender,
    };
  }

  private mapMatch(match: UserMatchRow, userId: string): UserMatchItemResponse {
    const subjectIsA = match.playerA?.userId === userId;
    const subject = subjectIsA ? match.playerA : match.playerB;
    const opponent = subjectIsA ? match.playerB : match.playerA;
    const subjectGames = subjectIsA ? match.playerAGames : match.playerBGames;
    const opponentGames = subjectIsA ? match.playerBGames : match.playerAGames;
    return {
      matchId: match.id,
      activityId: match.activityId,
      activityTitle: match.activity.title,
      stage: match.stage,
      roundNumber: match.round?.roundNumber ?? null,
      courtName: match.courtName,
      subjectUserId: userId,
      subjectParticipantName: subject?.participantName ?? '未知选手',
      subjectAvatarUrl: subject?.user?.avatarUrl ?? null,
      opponentUserId: opponent?.userId ?? null,
      opponentName: opponent?.participantName ?? '待定',
      opponentAvatarUrl: opponent?.user?.avatarUrl ?? null,
      subjectGames,
      opponentGames,
      subjectIsWinner: match.winnerId != null ? match.winnerId === subject?.id : null,
      recordStatus: match.recordStatus,
      confirmationState: match.confirmationState,
      startAt: match.startAt?.toISOString() ?? null,
    };
  }
}
