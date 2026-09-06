import { Injectable, NotFoundException } from '@nestjs/common';
import { USER_ROLES, type UpdateAuthProfileRequest, type UserRole } from '@ntr/shared';

import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface LoginSessionInput {
  openId: string;
  phone: string;
  tokenHash: string;
  expiresAt: Date;
  wechatSessionKey?: string;
}

interface DevSessionInput {
  userId?: string;
  phone?: string;
  name?: string;
  role?: UserRole;
  tokenHash: string;
  expiresAt: Date;
}

type EditableAuthProfile = UpdateAuthProfileRequest;

const DEV_DEFAULT_AVATAR_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 原子绑定微信身份与手机号，并创建新的服务端会话。 */
  createLoginSession(input: LoginSessionInput) {
    return this.prisma.$transaction(async (transaction) => {
      const [openIdUser, phoneUser] = await Promise.all([
        transaction.user.findUnique({ where: { wechatOpenId: input.openId } }),
        transaction.user.findUnique({ where: { phone: input.phone } }),
      ]);
      if (openIdUser && phoneUser && openIdUser.id !== phoneUser.id) return null;

      const existingUser = openIdUser ?? phoneUser;
      const user = existingUser
        ? await transaction.user.update({
            where: { id: existingUser.id },
            data: { phone: input.phone, wechatOpenId: input.openId },
          })
        : await transaction.user.create({
            data: { phone: input.phone, wechatOpenId: input.openId },
          });

      await transaction.userSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      });
      const session = await transaction.userSession.create({
        data: {
          userId: user.id,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          wechatSessionKey: input.wechatSessionKey,
        },
      });
      return { session, user };
    });
  }

  /** 开发环境创建业务会话，找不到指定账号时按 name 新建测试用户。 */
  createDevSession(input: DevSessionInput) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await this.findOrCreateDevUser(transaction, input);
      await transaction.userSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      });
      await transaction.userSession.create({
        data: { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
      });
      return user;
    });
  }

  private async findOrCreateDevUser(transaction: Prisma.TransactionClient, input: DevSessionInput) {
    const existing = await this.findDevUser(transaction, input);
    if (existing) {
      return transaction.user.update({
        where: { id: existing.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          name: existing.name ?? input.name ?? '开发测试用户',
          gender: existing.gender ?? 'MALE',
          avatarUrl: existing.avatarUrl ?? DEV_DEFAULT_AVATAR_URL,
          profileCompletedAt: existing.profileCompletedAt ?? new Date(),
        },
      });
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return transaction.user.create({
      data: {
        phone: `dev-${suffix}@dev.local`,
        wechatOpenId: `dev-openid-${suffix}`,
        name: input.name ?? '开发测试用户',
        role: input.role ?? USER_ROLES.USER,
        gender: 'MALE',
        avatarUrl: DEV_DEFAULT_AVATAR_URL,
        profileCompletedAt: new Date(),
      },
    });
  }

  private async findDevUser(transaction: Prisma.TransactionClient, input: DevSessionInput) {
    if (input.userId) {
      const user = await transaction.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new NotFoundException('开发登录用户不存在，请检查 userId');
      return user;
    }
    if (input.phone) {
      const user = await transaction.user.findUnique({ where: { phone: input.phone } });
      if (!user) throw new NotFoundException('开发登录用户不存在，请检查 phone');
      return user;
    }
    if (input.name) {
      return transaction.user.findFirst({
        where: { name: input.name },
        orderBy: { createdAt: 'desc' },
      });
    }
    return null;
  }

  /** 查询尚未过期的会话及其用户。 */
  findActiveSession(tokenHash: string) {
    return this.prisma.userSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  /** 更新当前用户可编辑的基础资料。 */
  updateProfile(userId: string, input: EditableAuthProfile) {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileCompletedAt: true },
      });
      const data: Prisma.UserUpdateInput = { ...input };
      const hasCompletedFields =
        data.name != null || current.profileCompletedAt == null
          ? Boolean(data.name && data.gender)
          : true;
      if (current.profileCompletedAt == null && hasCompletedFields) {
        data.profileCompletedAt = new Date();
      }
      return transaction.user.update({ where: { id: userId }, data });
    });
  }

  /** 撤销指定会话，不影响同一用户的其他设备。 */
  revokeSession(sessionId: string) {
    return this.prisma.userSession.deleteMany({ where: { id: sessionId } });
  }

  /** 将指定用户设为管理员。 */
  async setAdminRole(userId: string): Promise<{ userId: string; role: UserRole } | null> {
    const [user] = await this.prisma.user.updateManyAndReturn({
      where: { id: userId },
      data: { role: USER_ROLES.ADMIN },
      select: { id: true, role: true },
    });
    if (!user) return null;
    return { userId: user.id, role: user.role };
  }

  /** 撤销管理员（不允许撤销自己）。 */
  async demoteAdmin(actorId: string, userId: string): Promise<boolean> {
    if (actorId === userId) return false;
    const result = await this.prisma.user.updateManyAndReturn({
      where: { id: userId, role: USER_ROLES.ADMIN },
      data: { role: USER_ROLES.USER },
      select: { id: true },
    });
    return result.length > 0;
  }

  /** 管理员分页查询全部用户。 */
  findAdminUsers(keyword: string, page: number, pageSize: number) {
    const where: Prisma.UserWhereInput = keyword
      ? { name: { not: null, contains: keyword, mode: 'insensitive' as const } }
      : {};
    return Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, avatarUrl: true, role: true, createdAt: true },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ]).then(([users, total, roleGroups]) => {
      const countByRole = new Map(roleGroups.map((group) => [group.role, group._count._all]));
      return {
        users,
        total,
        summary: {
          totalUsers: roleGroups.reduce((sum, group) => sum + group._count._all, 0),
          adminCount: countByRole.get(USER_ROLES.ADMIN) ?? 0,
        },
      };
    });
  }
}
