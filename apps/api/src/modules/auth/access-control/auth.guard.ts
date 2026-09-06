import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OPTIONAL_AUTH_ROUTE_KEY, PUBLIC_ROUTE_KEY } from './auth.decorators';
import { AuthService } from '../auth.service';
import type { OptionallyAuthenticatedRequest } from '../auth.types';
import { parseBearerToken } from '../token/auth-token';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  /** 验证 Bearer 会话并把可信身份写入当前请求。 */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<OptionallyAuthenticatedRequest>();
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      if (optional) return true;
      throw new UnauthorizedException('请先登录');
    }
    try {
      request.auth = await this.authService.authenticate(token);
    } catch (error) {
      if (optional && error instanceof UnauthorizedException) return true;
      throw error;
    }
    return true;
  }
}
