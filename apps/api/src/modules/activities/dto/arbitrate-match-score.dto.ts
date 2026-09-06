import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import type { ArbitrateMatchScoreRequest } from '@ntr/shared';

export class ArbitrateMatchScoreDto implements ArbitrateMatchScoreRequest {
  @IsInt()
  @Min(0)
  playerAGames!: number;

  @IsInt()
  @Min(0)
  playerBGames!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  playerATiebreakPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  playerBTiebreakPoints?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
