import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MATCH_RULES, type MatchRuleCode, type UpdateActivityRequest } from '@ntr/shared';

const RULE_CODES = MATCH_RULES.map((rule) => rule.code);

export class UpdateActivityDto implements UpdateActivityRequest {
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(40)
  title?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(20)
  level?: string;

  @IsOptional()
  @IsISO8601()
  signupStartAt?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  locationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationAddress?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  courtCount?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(64)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  warmupMinutes?: number;

  @IsOptional()
  @IsIn(RULE_CODES)
  matchRuleCode?: MatchRuleCode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  groupCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  qualifyPerGroup?: number;

  @IsOptional()
  @IsBoolean()
  enableThirdPlace?: boolean;
}
