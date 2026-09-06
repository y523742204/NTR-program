import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';

import type { ActivityDetailResponse, ActivityListResponse } from '@ntr/shared';
import type { AuthenticatedRequest, OptionallyAuthenticatedRequest } from '../auth/auth.types';

import { OptionalAuth, Public, Roles } from '../auth/access-control/auth.decorators';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, toCreateActivityData } from './dto/create-activity.dto';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @Public()
  list(@Query() query: ListActivitiesQueryDto): Promise<ActivityListResponse> {
    return this.service.list(query);
  }

  @Get(':id')
  @OptionalAuth()
  detail(
    @Param('id') id: string,
    @Req() request: OptionallyAuthenticatedRequest,
  ): Promise<ActivityDetailResponse> {
    return this.service.detail(id, request.auth?.user);
  }

  @Post()
  @Roles('ADMIN')
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateActivityDto) {
    return this.service.create(request.auth.user, toCreateActivityData(body));
  }

  @Put(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: UpdateActivityDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
