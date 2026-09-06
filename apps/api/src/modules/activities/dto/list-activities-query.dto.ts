import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ACTIVITY_MODES } from '@ntr/shared';

export class ListActivitiesQueryDto {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): number => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): number => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;

  @IsOptional()
  @IsIn(['ALL', 'UPCOMING', 'ONGOING', 'FINISHED'])
  status?: 'ALL' | 'UPCOMING' | 'ONGOING' | 'FINISHED';

  @IsOptional()
  @IsIn([ACTIVITY_MODES.ROUND_ROBIN, ACTIVITY_MODES.GROUP_KNOCKOUT])
  mode?: string;
}
