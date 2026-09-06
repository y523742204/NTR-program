import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminUserListResponse,
  AuthSessionResponse,
  AuthUserResponse,
  AvatarUploadResponse,
  UpdateAuthProfileRequest,
} from '@ntr/shared';
import { USER_ROLES } from '@ntr/shared';

import { AuthRepository } from './auth.repository';
import { createSessionToken, hashSessionToken } from './token/auth-token';
import { AvatarStorageService, type AvatarFile } from './profile/avatar-storage.service';
import type { AuthenticatedSession } from './auth.types';
import { DevLoginDto } from './dto/dev-login.dto';
import { WechatPhoneLoginDto } from './dto/wechat-phone-login.dto';
import { WechatAuthService } from './wechat/wechat-auth.service';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
type AuthUser = Awaited<ReturnType<AuthRepository['updateProfile']>>;

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly wechat: WechatAuthService,
    private readonly avatarStorage: AvatarStorageService,
    private readonly config: ConfigService,
  ) {}

  /** 使用微信登录凭证和手机号签发业务会话。 */
  async loginWithWechatPhone(input: WechatPhoneLoginDto): Promise<AuthSessionResponse> {
    const [identity, phone] = await Promise.all([
      this.wechat.exchangeLoginCodeWithSessionKey(input.loginCode),
      this.wechat.exchangePhoneCode(input.phoneCode),
    ]);
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const result = await this.repository.createLoginSession({
      openId: identity.openId,
      phone,
      tokenHash: hashSessionToken(token),
      expiresAt,
      wechatSessionKey: identity.sessionKey,
    });
    if (!result) throw new ConflictException('该手机号已绑定其他微信账号');
    return { token, expiresAt: expiresAt.toISOString(), user: this.mapUser(result.user) };
  }

  /** 开发环境跳过微信授权，按测试身份直接创建业务会话。 */
  async devLogin(input: DevLoginDto): Promise<AuthSessionResponse> {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('该接口仅限开发环境使用');
    }
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const user = await this.repository.createDevSession({
      userId: input.userId,
      phone: input.phone,
      name: input.name,
      role: input.role,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    return { token, expiresAt: expiresAt.toISOString(), user: this.mapUser(user) };
  }

  /** 验证客户端业务令牌并返回当前会话。 */
  async authenticate(token: string): Promise<AuthenticatedSession> {
    const session = await this.repository.findActiveSession(hashSessionToken(token));
    if (!session?.user.phone) throw new UnauthorizedException('登录状态已失效');
    return {
      sessionId: session.id,
      user: this.mapUser(session.user),
    };
  }

  /** 保存头像文件并返回可提交到资料接口的站内路径。 */
  async uploadAvatar(file?: AvatarFile): Promise<AvatarUploadResponse> {
    return { avatarUrl: await this.avatarStorage.save(file) };
  }

  /** 更新当前用户资料并返回最新视图。 */
  async updateProfile(userId: string, input: UpdateAuthProfileRequest): Promise<AuthUserResponse> {
    const user = await this.repository.updateProfile(userId, input);
    return this.mapUser(user);
  }

  /** 撤销当前设备的服务端会话。 */
  async logout(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId);
  }

  /** 将指定用户设为管理员。 */
  async setAdminRole(userId: string): Promise<{ userId: string; role: string }> {
    const result = await this.repository.setAdminRole(userId);
    if (!result) throw new NotFoundException('用户不存在');
    return { userId: result.userId, role: result.role };
  }

  /** 撤销管理员权限（自身不可撤销）。 */
  async demoteAdmin(actorId: string, userId: string): Promise<{ userId: string; role: string }> {
    if (!(await this.repository.demoteAdmin(actorId, userId))) {
      throw new BadRequestException('不能撤销自己或该用户不是管理员');
    }
    return { userId, role: USER_ROLES.USER };
  }

  /** 管理员分页查询全部用户。 */
  async listAdminUsers(
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<AdminUserListResponse> {
    const result = await this.repository.findAdminUsers(keyword, page, pageSize);
    return {
      items: result.users.map((user) => ({
        userId: user.id,
        name: user.name?.trim() || '未设置昵称',
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      })),
      total: result.total,
      page,
      pageSize,
      summary: result.summary,
    };
  }

  private mapUser(user: AuthUser): AuthUserResponse {
    if (!user.phone) throw new UnauthorizedException('用户尚未绑定手机号');
    return {
      id: user.id,
      createdAt: user.createdAt.toISOString(),
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      role: user.role,
      profileCompleted: Boolean(user.profileCompletedAt && user.name && user.gender),
    };
  }
}
