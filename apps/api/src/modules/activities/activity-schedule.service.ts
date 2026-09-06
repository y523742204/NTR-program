import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { Activity } from '../../generated/prisma/client';
import {
  ACTIVITY_MODES,
  MATCH_STAGES,
  generateGroupRoundRobin,
  generateRoundRobin,
  getKnockoutStageDepth,
  getKnockoutStages,
  getStageMatchCount,
  splitIntoGroups,
  type ActivityRoundResponse,
  type ScheduleResponse,
} from '@ntr/shared';

import { ActivityRepository } from './activity.repository';
import { ActivitySignupRepository } from './activity-signup.repository';
import { ActivityMatchRepository, type MatchCreateInput } from './activity-match.repository';
import { mapActivityMatch } from './match-mapper';
import { allocateSlots, courtLabel } from './schedule-time';

@Injectable()
export class ActivityScheduleService {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly signupsRepo: ActivitySignupRepository,
    private readonly matchesRepo: ActivityMatchRepository,
  ) {}

  async generate(activityId: string): Promise<void> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.status === 'CANCELED') throw new BadRequestException('活动已取消，无法生成赛程');
    if (await this.matchesRepo.hasSchedule(activityId)) {
      throw new BadRequestException('赛程已生成，如需调整请重新生成');
    }
    await this.buildSchedule(activity);
  }

  async regenerate(activityId: string): Promise<void> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.startAt.getTime() <= Date.now()) {
      throw new BadRequestException('活动已开始，不允许重新生成赛程');
    }
    if (await this.matchesRepo.hasCompleted(activityId)) {
      throw new BadRequestException('已有比分录入，不能重新生成赛程');
    }
    await this.buildSchedule(activity);
  }

  async publish(activityId: string): Promise<void> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.status === 'CANCELED') throw new BadRequestException('活动已取消');
    await this.activities.update(activityId, { schedulePublishedAt: new Date() });
  }

  async getSchedule(activityId: string, meUserId?: string): Promise<ScheduleResponse> {
    const data = await this.activities.findScheduleData(activityId);
    if (!data) throw new NotFoundException('活动不存在');

    const rounds: ActivityRoundResponse[] = data.rounds.map((round) => ({
      roundId: round.id,
      roundNumber: round.roundNumber,
      matches: round.matches.map((match) => mapActivityMatch(match, meUserId)),
    }));

    const knockoutMatches = data.matches
      .filter((match) => match.stage !== MATCH_STAGES.THIRD_PLACE)
      .sort(
        (a, b) =>
          getKnockoutStageDepth(b.stage ?? MATCH_STAGES.FINAL) -
            getKnockoutStageDepth(a.stage ?? MATCH_STAGES.FINAL) ||
          (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0),
      )
      .map((match) => mapActivityMatch(match, meUserId));

    const thirdPlaceRow = data.matches.find((match) => match.stage === MATCH_STAGES.THIRD_PLACE);

    return {
      published: Boolean(data.schedulePublishedAt),
      rounds,
      knockout: knockoutMatches,
      thirdPlace: thirdPlaceRow ? mapActivityMatch(thirdPlaceRow, meUserId) : null,
    };
  }

  private async buildSchedule(activity: Activity) {
    const counts = await this.signupsRepo.countByStatus(activity.id);
    if (counts.confirmed < 2) {
      throw new BadRequestException('确认报名人数不足，无法生成赛程');
    }
    const signups = await this.signupsRepo.findByOpen(activity.id);
    await this.matchesRepo.clearSchedule(activity.id);
    if (activity.mode === ACTIVITY_MODES.ROUND_ROBIN) {
      await this.buildRoundRobin(
        activity,
        signups.map((item) => item.id),
      );
    } else {
      await this.buildGroupKnockout(
        activity,
        signups.map((item) => item.id),
      );
    }
  }

  private async buildRoundRobin(activity: Activity, signupIds: string[]) {
    const rounds = generateRoundRobin(signupIds);
    const slots = allocateSlots(
      activity.startAt,
      activity.endAt,
      activity.warmupMinutes,
      rounds.length,
    );
    for (let r = 0; r < rounds.length; r += 1) {
      const time = slots[r];
      const matches: MatchCreateInput[] = rounds[r].map(([playerAId, playerBId], index) => ({
        playerAId,
        playerBId,
        stage: null,
        groupNumber: null,
        bracketSlot: null,
        courtName: courtLabel(index, activity.courtCount),
        startAt: time.startAt,
        endAt: time.endAt,
      }));
      await this.matchesRepo.createRound(activity.id, r + 1, matches);
    }
  }

  private async buildGroupKnockout(activity: Activity, signupIds: string[]) {
    const groupCount = activity.groupCount;
    const qualifyPerGroup = activity.qualifyPerGroup;
    if (!groupCount || !qualifyPerGroup) {
      throw new BadRequestException('活动缺少小组赛配置，请先完善配置');
    }
    const playersPerGroup = signupIds.length / groupCount;
    if (!Number.isInteger(playersPerGroup) || playersPerGroup < 2) {
      throw new BadRequestException(`当前 ${signupIds.length} 人无法均分为 ${groupCount} 组`);
    }
    const knockoutStages = getKnockoutStages(groupCount * qualifyPerGroup);
    const thirdEnabled = Boolean(activity.enableThirdPlace) && groupCount * qualifyPerGroup >= 4;

    const groups = splitIntoGroups(signupIds, groupCount);
    const groupRounds = generateGroupRoundRobin(groups);
    const maxRounds = Math.max(...groupRounds.map((group) => group.roundPairs.length));
    const totalSlots = maxRounds + knockoutStages.length + (thirdEnabled ? 1 : 0);
    const slots = allocateSlots(
      activity.startAt,
      activity.endAt,
      activity.warmupMinutes,
      totalSlots,
    );

    for (let r = 0; r < maxRounds; r += 1) {
      const time = slots[r];
      const matches: MatchCreateInput[] = [];
      let courtIndex = 0;
      for (const group of groupRounds) {
        for (const [playerAId, playerBId] of group.roundPairs[r] ?? []) {
          matches.push({
            playerAId,
            playerBId,
            stage: MATCH_STAGES.GROUP,
            groupNumber: group.groupNumber,
            bracketSlot: null,
            courtName: courtLabel(courtIndex, activity.courtCount),
            startAt: time.startAt,
            endAt: time.endAt,
          });
          courtIndex += 1;
        }
      }
      await this.matchesRepo.createRound(activity.id, r + 1, matches);
    }

    const skeleton: MatchCreateInput[] = [];
    let courtIndex = 0;
    knockoutStages.forEach((stage, stageIndex) => {
      const stageDepth = getKnockoutStageDepth(stage);
      const count = getStageMatchCount(stageDepth);
      const time = slots[maxRounds + stageIndex];
      for (let slot = 0; slot < count; slot += 1) {
        skeleton.push({
          playerAId: null,
          playerBId: null,
          stage,
          bracketSlot: slot,
          courtName: courtLabel(courtIndex, activity.courtCount),
          startAt: time.startAt,
          endAt: time.endAt,
        });
        courtIndex += 1;
      }
    });
    if (thirdEnabled) {
      const time = slots[totalSlots - 1];
      skeleton.push({
        playerAId: null,
        playerBId: null,
        stage: MATCH_STAGES.THIRD_PLACE,
        bracketSlot: 0,
        courtName: courtLabel(courtIndex, activity.courtCount),
        startAt: time.startAt,
        endAt: time.endAt,
      });
    }
    await this.matchesRepo.createKnockoutMatches(activity.id, skeleton);
  }
}
