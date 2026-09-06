import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';

import type { ActivityMatchResponse } from '@ntr/shared';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { Roles } from '../auth/access-control/auth.decorators';
import { ActivityScoreService } from './activity-score.service';
import { ArbitrateMatchScoreDto } from './dto/arbitrate-match-score.dto';
import { DisputeMatchScoreDto } from './dto/dispute-match-score.dto';
import { MarkUnplayedDto } from './dto/mark-match-unplayed.dto';
import { SaveMatchScoreDto } from './dto/save-match-score.dto';

@Controller('activities')
export class ActivityScoreController {
  constructor(private readonly service: ActivityScoreService) {}

  @Patch(':id/matches/:matchId/score')
  saveScore(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SaveMatchScoreDto,
  ): Promise<ActivityMatchResponse> {
    return this.service.saveScore(request.auth.user, id, matchId, body);
  }

  @Post(':id/matches/:matchId/confirm')
  confirm(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActivityMatchResponse> {
    return this.service.confirmScore(request.auth.user, id, matchId);
  }

  @Post(':id/matches/:matchId/dispute')
  dispute(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: DisputeMatchScoreDto,
  ): Promise<ActivityMatchResponse> {
    return this.service.disputeScore(request.auth.user, id, matchId, body.reason);
  }

  @Post(':id/matches/:matchId/arbitrate')
  @Roles('ADMIN')
  arbitrate(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ArbitrateMatchScoreDto,
  ): Promise<ActivityMatchResponse> {
    return this.service.arbitrate(request.auth.user, id, matchId, body);
  }

  @Post(':id/matches/:matchId/unplayed')
  @Roles('ADMIN')
  unplayed(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: MarkUnplayedDto,
  ): Promise<ActivityMatchResponse> {
    return this.service.markUnplayed(request.auth.user, id, matchId, body.reason);
  }
}
