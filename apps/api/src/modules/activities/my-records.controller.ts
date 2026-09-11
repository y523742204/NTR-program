import { Controller, Get, Param, Query, Req } from '@nestjs/common';

import type { MySignupListResponse, UserRecordsResponse } from '@ntr/shared';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { Public } from '../auth/access-control/auth.decorators';
import { MyRecordsService } from './my-records.service';
import { ListRecordsQueryDto } from './dto/list-records-query.dto';

@Controller('activities')
export class MyRecordsController {
  constructor(private readonly service: MyRecordsService) {}

  @Get('users/:userId/records')
  @Public()
  userRecords(
    @Param('userId') userId: string,
    @Query() query: ListRecordsQueryDto,
  ): Promise<UserRecordsResponse> {
    return this.service.getUserRecords(userId, query.page, query.pageSize);
  }

  @Get('signups/me')
  mySignups(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRecordsQueryDto,
  ): Promise<MySignupListResponse> {
    return this.service.mySignups(request.auth.user, query.page, query.pageSize);
  }
}
