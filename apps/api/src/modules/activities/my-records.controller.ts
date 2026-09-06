import { Controller, Get, Query, Req } from '@nestjs/common';

import type { MyMatchListResponse, MySignupListResponse } from '@ntr/shared';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { MyRecordsService } from './my-records.service';
import { ListRecordsQueryDto } from './dto/list-records-query.dto';

@Controller('activities')
export class MyRecordsController {
  constructor(private readonly service: MyRecordsService) {}

  @Get('matches/me')
  myMatches(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRecordsQueryDto,
  ): Promise<MyMatchListResponse> {
    return this.service.myMatches(request.auth.user, query.page, query.pageSize);
  }

  @Get('signups/me')
  mySignups(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRecordsQueryDto,
  ): Promise<MySignupListResponse> {
    return this.service.mySignups(request.auth.user, query.page, query.pageSize);
  }
}
