import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { DeleteMySignupResponse, SignupActivityResponse } from '@ntr/shared';

import { ActivityRepository } from './activity.repository';
import { ActivitySignupRepository } from './activity-signup.repository';
import { mapSignupResponse } from './signup-mapper';
import { SignupActivityDto } from './dto/signup-activity.dto';

@Injectable()
export class ActivitySignupService {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly signups: ActivitySignupRepository,
  ) {}

  async join(
    actor: AuthenticatedUser,
    activityId: string,
    dto: SignupActivityDto,
  ): Promise<SignupActivityResponse> {
    const activity = await this.activities.findByIdOrThrow(activityId);
    if (activity.status === 'CANCELED') throw new BadRequestException('活动已取消，无法报名');
    const now = new Date();
    if (now < activity.signupStartAt) throw new BadRequestException('报名尚未开始');
    if (now > activity.endAt) throw new BadRequestException('活动已结束');

    const existing = await this.signups.findMy(activityId, actor.id);
    if (existing) throw new ConflictException('你已报名该活动');

    const counts = await this.signups.countByStatus(activityId);
    const status = counts.confirmed >= activity.maxPlayers ? 'WAITLISTED' : 'CONFIRMED';

    const participantName = dto.participantName?.trim() || actor.name || '球友';
    const gender = dto.gender ?? actor.gender ?? null;

    let signup: Awaited<ReturnType<ActivitySignupRepository['create']>>;
    try {
      signup = await this.signups.create({
        activityId,
        userId: actor.id,
        participantName,
        gender,
        status,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('你已报名或该昵称已被占用');
      }
      throw error;
    }

    return { signup: mapSignupResponse(signup, actor.id) };
  }

  async cancel(actor: AuthenticatedUser, activityId: string): Promise<DeleteMySignupResponse> {
    const signup = await this.signups.findMy(activityId, actor.id);
    if (!signup) throw new NotFoundException('你尚未报名该活动');
    await this.signups.remove(signup.id);
    await this.signups.promoteFirstWaitlisted(activityId);
    return { signupId: signup.id };
  }

  async removeByAdmin(
    actor: AuthenticatedUser,
    activityId: string,
    signupId: string,
  ): Promise<DeleteMySignupResponse> {
    if (actor.role !== 'ADMIN') throw new ConflictException('仅管理员可移除报名');
    const signup = await this.signups.findById(signupId);
    if (!signup || signup.activityId !== activityId) throw new NotFoundException('报名记录不存在');
    await this.signups.remove(signup.id);
    await this.signups.promoteFirstWaitlisted(activityId);
    return { signupId: signup.id };
  }
}
