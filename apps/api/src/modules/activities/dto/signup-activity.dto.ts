import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ParticipantGender, SignupActivityRequest } from '@ntr/shared';

export class SignupActivityDto implements SignupActivityRequest {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  participantName?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE'] as const)
  gender?: ParticipantGender;
}
