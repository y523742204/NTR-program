import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActivitySignupRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 报名的活动确认名额统计（并发报名以唯一约束兜底）。 */
  async countByStatus(activityId: string) {
    const groups = await this.prisma.activitySignup.groupBy({
      by: ['status'],
      where: { activityId },
      _count: { _all: true },
    });
    let confirmed = 0;
    let waitlisted = 0;
    for (const group of groups) {
      if (group.status === 'CONFIRMED') confirmed = group._count._all;
      else if (group.status === 'WAITLISTED') waitlisted = group._count._all;
    }
    return { confirmed, waitlisted };
  }

  findByOpen(activityId: string) {
    return this.prisma.activitySignup.findMany({
      where: { activityId, status: 'CONFIRMED' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, avatarUrl: true } } },
    });
  }

  findMy(activityId: string, userId: string) {
    return this.prisma.activitySignup.findFirst({
      where: { activityId, userId },
    });
  }

  findById(signupId: string) {
    return this.prisma.activitySignup.findUnique({ where: { id: signupId } });
  }

  create(data: Prisma.ActivitySignupUncheckedCreateInput) {
    return this.prisma.activitySignup.create({ data });
  }

  remove(id: string) {
    return this.prisma.activitySignup.delete({ where: { id } });
  }

  /** 将最早候补晋升为确认，返回被晋升的报名（无候补时返回 null）。 */
  promoteFirstWaitlisted(activityId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const waitlisted = await transaction.activitySignup.findFirst({
        where: { activityId, status: 'WAITLISTED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!waitlisted) return null;
      return transaction.activitySignup.update({
        where: { id: waitlisted.id },
        data: { status: 'CONFIRMED' },
      });
    });
  }
}
