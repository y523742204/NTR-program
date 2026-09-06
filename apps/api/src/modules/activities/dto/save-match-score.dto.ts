import { IsInt, IsOptional, Min } from 'class-validator';
import type { SaveMatchScoreRequest } from '@ntr/shared';

export class SaveMatchScoreDto implements SaveMatchScoreRequest {
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
}
