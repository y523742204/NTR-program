import { Controller, Get, Param, Req } from '@nestjs/common';

import type {
  GroupStandingsResponse,
  KnockoutBracketResponse,
  RoundRobinStandingsResponse,
} from '@ntr/shared';
import type { OptionallyAuthenticatedRequest } from '../auth/auth.types';

import { OptionalAuth } from '../auth/access-control/auth.decorators';
import { ActivityStandingsService } from './activity-standings.service';

@Controller('activities')
export class ActivityStandingsController {
  constructor(private readonly service: ActivityStandingsService) {}

  @Get(':id/standings')
  @OptionalAuth()
  standings(
    @Param('id') id: string,
    @Req() request: OptionallyAuthenticatedRequest,
  ): Promise<RoundRobinStandingsResponse | GroupStandingsResponse> {
    return this.service.getStandings(id, request.auth?.user?.id);
  }

  @Get(':id/bracket')
  @OptionalAuth()
  bracket(
    @Param('id') id: string,
    @Req() request: OptionallyAuthenticatedRequest,
  ): Promise<KnockoutBracketResponse> {
    return this.service.getBracket(id, request.auth?.user?.id);
  }
}
