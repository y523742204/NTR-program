import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAdminUsersQueryDto {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  keyword?: string;

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
