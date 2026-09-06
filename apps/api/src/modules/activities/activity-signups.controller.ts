import { Body, Controller, Delete, Param, Post, Req } from '@nestjs/common';

import type { DeleteMySignupResponse, SignupActivityResponse } from '@ntr/shared';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { Roles } from '../auth/access-control/auth.decorators';
import { ActivitySignupService } from './activity-signup.service';
import { SignupActivityDto } from './dto/signup-activity.dto';

@Controller('activities')
export class ActivitySignupsController {
  constructor(private readonly service: ActivitySignupService) {}

  @Post(':id/signups')
  join(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SignupActivityDto,
  ): Promise<SignupActivityResponse> {
    return this.service.join(request.auth.user, id, body);
  }

  @Delete(':id/signups/me')
  cancel(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.cancel(request.auth.user, id);
  }

  @Delete(':id/signups/:signupId')
  @Roles('ADMIN')
  removeByAdmin(
    @Param('id') id: string,
    @Param('signupId') signupId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeleteMySignupResponse> {
    return this.service.removeByAdmin(request.auth.user, id, signupId);
  }
}
