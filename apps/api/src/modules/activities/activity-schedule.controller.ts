import { Controller, Get, Param, Post, Req } from '@nestjs/common';

import type { ScheduleResponse } from '@ntr/shared';
import type { OptionallyAuthenticatedRequest } from '../auth/auth.types';

import { OptionalAuth, Roles } from '../auth/access-control/auth.decorators';
import { ActivityScheduleService } from './activity-schedule.service';

@Controller('activities')
export class ActivityScheduleController {
  constructor(private readonly service: ActivityScheduleService) {}

  @Get(':id/schedule')
  @OptionalAuth()
  get(
    @Param('id') id: string,
    @Req() request: OptionallyAuthenticatedRequest,
  ): Promise<ScheduleResponse> {
    return this.service.getSchedule(id, request.auth?.user?.id);
  }

  @Post(':id/schedule')
  @Roles('ADMIN')
  async generate(@Param('id') id: string): Promise<void> {
    await this.service.generate(id);
  }

  @Post(':id/schedule/publish')
  @Roles('ADMIN')
  async publish(@Param('id') id: string): Promise<void> {
    await this.service.publish(id);
  }

  @Post(':id/schedule/regenerate')
  @Roles('ADMIN')
  async regenerate(@Param('id') id: string): Promise<void> {
    await this.service.regenerate(id);
  }
}
