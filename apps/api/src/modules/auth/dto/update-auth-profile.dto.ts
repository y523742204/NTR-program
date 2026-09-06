import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { ParticipantGender, UpdateAuthProfileRequest } from '@ntr/shared';

const PROFILE_GENDERS: readonly ParticipantGender[] = ['MALE', 'FEMALE'];
const AVATAR_PATH_PATTERN = /^\/uploads\/avatars\/[0-9a-f-]+\.(?:jpe?g|png|webp)$/;

export class UpdateAuthProfileDto implements UpdateAuthProfileRequest {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name?: string;

  @IsOptional()
  @IsIn(PROFILE_GENDERS)
  gender?: ParticipantGender;

  @IsOptional()
  @IsString()
  @Matches(AVATAR_PATH_PATTERN)
  avatarUrl?: string;
}
