import { IsString, MaxLength, MinLength } from 'class-validator';
import type { DisputeMatchScoreRequest } from '@ntr/shared';

export class DisputeMatchScoreDto implements DisputeMatchScoreRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason!: string;
}
