import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  ALLOW_INCOMPLETE_PROFILE_KEY,
  OPTIONAL_AUTH_ROUTE_KEY,
  PUBLIC_ROUTE_KEY,
} from './auth.decorators';
import type { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class ProfileCompletionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_ROUTE_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_INCOMPLETE_PROFILE_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw new UnauthorizedException('请先登录');
    if (!request.auth.user.profileCompleted) {
      throw new ForbiddenException('请先完善个人资料');
    }
    return true;
  }
}
