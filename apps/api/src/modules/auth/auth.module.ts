import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { DatabaseModule } from '../../database/database.module';
import { AuthGuard } from './access-control/auth.guard';
import { ProfileCompletionGuard } from './access-control/profile-completion.guard';
import { RolesGuard } from './access-control/roles.guard';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AvatarStorageService } from './profile/avatar-storage.service';
import { WechatAuthService } from './wechat/wechat-auth.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    AvatarStorageService,
    WechatAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ProfileCompletionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, WechatAuthService],
})
export class AuthModule {}
