import { Injectable, NotFoundException } from '@nestjs/common';

import type { ActivityMode } from '@ntr/shared';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { matchInclude } from './match-mapper';

export interface ActivityListParams {
  page: number;
  pageSize: number;
  status?: 'ALL' | 'UPCOMING' | 'ONGOING' | 'FINISHED';
  mode?: string;
}

type ActivityCreateData = Parameters<PrismaService['activity']['create']>[0]['data'];

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.activity.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('活动不存在');
    return activity;
  }

  async list(params: ActivityListParams) {
    const now = new Date();
    const where: Prisma.ActivityWhereInput = { status: 'PUBLISHED' };
    if (params.mode) where.mode = params.mode as ActivityMode;
    if (params.status === 'UPCOMING') {
      where.startAt = { gt: now };
    } else if (params.status === 'ONGOING') {
      where.startAt = { lte: now };
      where.endAt = { gte: now };
    } else if (params.status === 'FINISHED') {
      where.endAt = { lt: now };
    }

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: [
          { startAt: params.status === 'FINISHED' ? 'desc' : 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          signupStartAt: true,
          startAt: true,
          endAt: true,
          locationName: true,
          courtCount: true,
          maxPlayers: true,
          coverImageUrl: true,
          schedulePublishedAt: true,
        },
      }),
      this.prisma.activity.count({ where }),
    ]);
    const counts = await this.countSignupsByActivity(activities.map((item) => item.id));
    return { activities, total, counts };
  }

  /** 批量统计活动的确认/候补报名数。 */
  async countSignupsByActivity(activityIds: string[]) {
    if (activityIds.length === 0)
      return new Map<string, { confirmed: number; waitlisted: number }>();
    const [confirmed, waitlisted] = await Promise.all([
      this.prisma.activitySignup.groupBy({
        by: ['activityId'],
        where: { activityId: { in: activityIds }, status: 'CONFIRMED' },
        _count: { _all: true },
      }),
      this.prisma.activitySignup.groupBy({
        by: ['activityId'],
        where: { activityId: { in: activityIds }, status: 'WAITLISTED' },
        _count: { _all: true },
      }),
    ]);
    const confirmedMap = new Map(confirmed.map((g) => [g.activityId, g._count._all]));
    const waitlistedMap = new Map(waitlisted.map((g) => [g.activityId, g._count._all]));
    const result = new Map<string, { confirmed: number; waitlisted: number }>();
    for (const id of activityIds) {
      result.set(id, {
        confirmed: confirmedMap.get(id) ?? 0,
        waitlisted: waitlistedMap.get(id) ?? 0,
      });
    }
    return result;
  }

  findDetailFull(id: string) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        signups: {
          include: { user: { select: { id: true, avatarUrl: true } } },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: { matches: { include: matchInclude, orderBy: { courtName: 'asc' } } },
        },
        matches: {
          where: { roundId: null },
          orderBy: [{ stage: 'asc' }, { bracketSlot: 'asc' }],
          include: matchInclude,
        },
      },
    });
  }

  findScheduleData(id: string) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: { matches: { include: matchInclude, orderBy: { courtName: 'asc' } } },
        },
        matches: {
          where: { roundId: null },
          orderBy: [{ stage: 'asc' }, { bracketSlot: 'asc' }],
          include: matchInclude,
        },
      },
    });
  }

  create(data: ActivityCreateData) {
    return this.prisma.activity.create({ data });
  }

  update(id: string, data: Prisma.ActivityUpdateInput) {
    return this.prisma.activity.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.activity.delete({ where: { id } });
  }
}
