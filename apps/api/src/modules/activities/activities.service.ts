import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  ACTIVITY_MODES,
  getKnockoutStages,
  MATCH_RULES,
  type ActivityDetailResponse,
  type ActivityListItemResponse,
  type ActivityListResponse,
  type MatchRuleCode,
} from '@ntr/shared';

import type { Activity, Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ActivityRepository, type ActivityListParams } from './activity.repository';
import { mapSignupResponse } from './signup-mapper';
import { CreateActivityData } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly activities: ActivityRepository) {}

  async list(query: ActivityListParams): Promise<ActivityListResponse> {
    const { activities, total, counts } = await this.activities.list(query);
    const items: ActivityListItemResponse[] = activities.map((activity) => {
      const count = counts.get(activity.id) ?? { confirmed: 0, waitlisted: 0 };
      return {
        id: activity.id,
        title: activity.title,
        level: activity.level,
        mode: activity.mode,
        status: activity.status,
        signupStartAt: activity.signupStartAt.toISOString(),
        startAt: activity.startAt.toISOString(),
        endAt: activity.endAt.toISOString(),
        locationName: activity.locationName,
        courtCount: activity.courtCount,
        maxPlayers: activity.maxPlayers,
        signupCount: count.confirmed,
        waitlistedCount: count.waitlisted,
        schedulePublished: Boolean(activity.schedulePublishedAt),
        coverImageUrl: activity.coverImageUrl,
      };
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(activityId: string, actor?: AuthenticatedUser): Promise<ActivityDetailResponse> {
    const data = await this.activities.findDetailFull(activityId);
    if (!data) throw new NotFoundException('活动不存在');
    const meId = actor?.id ?? null;
    const isAdmin = actor?.role === 'ADMIN';

    const signups = data.signups.map((signup) => mapSignupResponse(signup, meId));
    const confirmed = signups.filter((signup) => signup.status === 'CONFIRMED').length;
    const waitlisted = data.signups.length - confirmed;

    return {
      id: data.id,
      title: data.title,
      note: data.note,
      coverImageUrl: data.coverImageUrl,
      level: data.level,
      mode: data.mode,
      status: data.status,
      signupStartAt: data.signupStartAt.toISOString(),
      startAt: data.startAt.toISOString(),
      endAt: data.endAt.toISOString(),
      locationName: data.locationName,
      locationAddress: data.locationAddress,
      latitude: data.latitude,
      longitude: data.longitude,
      venue: data.venue,
      maxPlayers: data.maxPlayers,
      courtCount: data.courtCount,
      warmupMinutes: data.warmupMinutes,
      matchRuleCode: data.matchRuleCode as MatchRuleCode,
      groupCount: data.groupCount,
      qualifyPerGroup: data.qualifyPerGroup,
      enableThirdPlace: data.enableThirdPlace,
      creatorName: data.creator?.name ?? null,
      isCreator: Boolean(data.creatorId && data.creatorId === meId),
      canManage: Boolean(isAdmin || (data.creatorId && data.creatorId === meId)),
      signupCount: confirmed,
      waitlistedCount: waitlisted,
      schedulePublished: Boolean(data.schedulePublishedAt),
      mySignup: signups.find((signup) => signup.isMe) ?? null,
      signups,
      createdAt: data.createdAt.toISOString(),
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateActivityData): Promise<Activity> {
    this.validateScheme(dto);
    const title = dto.title?.trim() || buildAutoTitle(actor.name, dto.startAt);
    return this.activities.create({
      title,
      level: dto.level ?? null,
      mode: dto.mode,
      signupStartAt: dto.signupStartAt,
      startAt: dto.startAt,
      endAt: dto.endAt,
      locationName: dto.locationName,
      locationAddress: dto.locationAddress ?? '',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      venue: dto.venue ?? null,
      note: dto.note ?? null,
      coverImageUrl: null,
      courtCount: dto.courtCount,
      maxPlayers: dto.maxPlayers,
      warmupMinutes: dto.warmupMinutes ?? 10,
      matchRuleCode: dto.matchRuleCode ?? 'FOUR_GAMES_NO_AD',
      groupCount: dto.groupCount ?? null,
      qualifyPerGroup: dto.qualifyPerGroup ?? null,
      enableThirdPlace: dto.enableThirdPlace ?? null,
      creatorId: actor.id,
    });
  }

  async update(activityId: string, dto: UpdateActivityDto): Promise<Activity> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    const data = this.buildUpdateData(activity, dto);
    return this.activities.update(activityId, data);
  }

  async remove(activityId: string): Promise<void> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    await this.activities.remove(activity.id);
  }

  private validateScheme(dto: CreateActivityData) {
    const mode = dto.mode;
    const maxPlayers = dto.maxPlayers;
    const groupCount = dto.groupCount;
    const qualifyPerGroup = dto.qualifyPerGroup;

    if (dto.endAt.getTime() <= dto.startAt.getTime()) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    if (!dto.matchRuleCode || !MATCH_RULES.some((rule) => rule.code === dto.matchRuleCode)) {
      throw new BadRequestException('赛制无效');
    }
    if (mode === ACTIVITY_MODES.GROUP_KNOCKOUT) {
      if (!groupCount || !qualifyPerGroup) {
        throw new BadRequestException('小组赛需填写小组数与每组出线数');
      }
      if (maxPlayers % groupCount !== 0 || maxPlayers / groupCount < 2) {
        throw new BadRequestException('参赛人数需大于每组 2 人且能整除分组数');
      }
      try {
        getKnockoutStages(groupCount * qualifyPerGroup);
      } catch {
        throw new BadRequestException('小组数 × 出线数必须是 2~32 的 2 的幂');
      }
    }
  }

  private buildUpdateData(activity: Activity, dto: UpdateActivityDto): Prisma.ActivityUpdateInput {
    const data: Prisma.ActivityUpdateInput = {};
    if (dto.title != null) data.title = dto.title.trim() || buildAutoTitle(null, activity.startAt);
    if (dto.level != null) data.level = dto.level.trim() || null;
    if (dto.note != null) data.note = dto.note ?? null;
    if (dto.signupStartAt != null) data.signupStartAt = new Date(dto.signupStartAt);
    if (dto.startAt != null) data.startAt = new Date(dto.startAt);
    if (dto.endAt != null) data.endAt = new Date(dto.endAt);
    if (dto.locationName != null) data.locationName = dto.locationName;
    if (dto.locationAddress != null) data.locationAddress = dto.locationAddress;
    if (dto.latitude != null) data.latitude = dto.latitude;
    if (dto.longitude != null) data.longitude = dto.longitude;
    if (dto.venue != null) data.venue = dto.venue ?? null;
    if (dto.courtCount != null) data.courtCount = dto.courtCount;
    if (dto.maxPlayers != null) data.maxPlayers = dto.maxPlayers;
    if (dto.warmupMinutes != null) data.warmupMinutes = dto.warmupMinutes;
    if (dto.matchRuleCode != null) data.matchRuleCode = dto.matchRuleCode;
    if (dto.groupCount != null) data.groupCount = dto.groupCount;
    if (dto.qualifyPerGroup != null) data.qualifyPerGroup = dto.qualifyPerGroup;
    if (dto.enableThirdPlace != null) data.enableThirdPlace = dto.enableThirdPlace;

    if (dto.endAt && dto.startAt) {
      if (new Date(dto.endAt).getTime() <= new Date(dto.startAt).getTime()) {
        throw new BadRequestException('结束时间必须晚于开始时间');
      }
    }
    return data;
  }
}

function buildAutoTitle(creatorName: string | null, startAt: Date): string {
  const name = creatorName || '管理员';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${name} ${startAt.getMonth() + 1}月${startAt.getDate()}日 ${pad(startAt.getHours())}:${pad(startAt.getMinutes())}`;
}
