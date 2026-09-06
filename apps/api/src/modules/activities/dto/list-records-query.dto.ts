import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListRecordsQueryDto {
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
}
