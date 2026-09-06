import { Injectable } from '@nestjs/common';

import type { MyMatchListResponse, MySignupListResponse } from '@ntr/shared';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

const MATCH_LIST_INCLUDE = {
  activity: { select: { id: true, title: true } },
  round: { select: { roundNumber: true } },
  playerA: { include: { user: { select: { avatarUrl: true } } } },
  playerB: { include: { user: { select: { avatarUrl: true } } } },
} as const;

@Injectable()
export class MyRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async myMatches(
    actor: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<MyMatchListResponse> {
    const where = {
      OR: [{ playerA: { is: { userId: actor.id } } }, { playerB: { is: { userId: actor.id } } }],
    };
    const [matches, total] = await Promise.all([
      this.prisma.activityMatch.findMany({
        where,
        include: MATCH_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activityMatch.count({ where }),
    ]);

    const items = matches.map((match) => {
      const mine = match.playerA?.userId === actor.id ? 'A' : 'B';
      const mySignupId = mine === 'A' ? match.playerAId : match.playerBId;
      const myName = mine === 'A' ? match.playerA?.participantName : match.playerB?.participantName;
      const opponent = mine === 'A' ? match.playerB : match.playerA;
      const myGames = mine === 'A' ? match.playerAGames : match.playerBGames;
      const opponentGames = mine === 'A' ? match.playerBGames : match.playerAGames;
      return {
        matchId: match.id,
        activityId: match.activityId,
        activityTitle: match.activity.title,
        stage: match.stage,
        roundNumber: match.round?.roundNumber ?? null,
        courtName: match.courtName,
        myParticipantName: myName ?? '未知选手',
        opponentName: opponent?.participantName ?? '待定',
        opponentAvatarUrl: opponent?.user?.avatarUrl ?? null,
        myGames,
        opponentGames,
        isWinner: match.winnerId != null ? match.winnerId === mySignupId : null,
        recordStatus: match.recordStatus,
        confirmationState: match.confirmationState,
        startAt: match.startAt?.toISOString() ?? null,
      };
    });

    return { items, total, page, pageSize };
  }

  async mySignups(
    actor: AuthenticatedUser,
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
}
