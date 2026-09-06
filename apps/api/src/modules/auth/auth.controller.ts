import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { AdminUserListResponse, AuthSessionResponse, AvatarUploadResponse } from '@ntr/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { AllowIncompleteProfile, Public, Roles } from './access-control/auth.decorators';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { DevLoginDto } from './dto/dev-login.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { SetAdminRoleDto } from './dto/set-admin-role.dto';
import { UpdateAuthProfileDto } from './dto/update-auth-profile.dto';
import { WechatPhoneLoginDto } from './dto/wechat-phone-login.dto';
import { MAX_AVATAR_SIZE_BYTES, type AvatarFile } from './profile/avatar-storage.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-phone-login')
  @Public()
  login(@Body() input: WechatPhoneLoginDto): Promise<AuthSessionResponse> {
    return this.authService.loginWithWechatPhone(input);
  }

  @Post('dev-login')
  @Public()
  @AllowIncompleteProfile()
  devLogin(@Body() input: DevLoginDto): Promise<AuthSessionResponse> {
    return this.authService.devLogin(input);
  }

  @Get('me')
  @AllowIncompleteProfile()
  getCurrentUser(@Req() request: AuthenticatedRequest): AuthSessionResponse['user'] {
    return request.auth.user;
  }

  @Post('avatar')
  @AllowIncompleteProfile()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_SIZE_BYTES, files: 1 } }),
  )
  uploadAvatar(@UploadedFile() file?: AvatarFile): Promise<AvatarUploadResponse> {
    return this.authService.uploadAvatar(file);
  }

  @Patch('me')
  @AllowIncompleteProfile()
  updateProfile(@Req() request: AuthenticatedRequest, @Body() input: UpdateAuthProfileDto) {
    return this.authService.updateProfile(request.auth.user.id, input);
  }

  @Delete('session')
  @AllowIncompleteProfile()
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(request.auth.sessionId);
  }

  @Post('admin')
  @Roles('ADMIN')
  setAdmin(@Body() input: SetAdminRoleDto): Promise<{ userId: string; role: string }> {
    return this.authService.setAdminRole(input.userId);
  }

  @Delete('admin/:userId')
  @Roles('ADMIN')
  demoteAdmin(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{ userId: string; role: string }> {
    return this.authService.demoteAdmin(request.auth.user.id, userId);
  }

  @Get('admin/users')
  @Roles('ADMIN')
  listUsers(@Query() query: ListAdminUsersQueryDto): Promise<AdminUserListResponse> {
    return this.authService.listAdminUsers(query.keyword ?? '', query.page, query.pageSize);
  }
}
