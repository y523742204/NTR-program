import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { MarkUnplayedRequest } from '@ntr/shared';

export class MarkUnplayedDto implements MarkUnplayedRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
