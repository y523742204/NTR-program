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
import {
  ACTIVITY_MODES,
  MATCH_RULES,
  type ActivityMode,
  type CreateActivityRequest,
  type MatchRuleCode,
} from '@ntr/shared';

const RULE_CODES = MATCH_RULES.map((rule) => rule.code);

export class CreateActivityDto implements CreateActivityRequest {
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

  @IsIn([ACTIVITY_MODES.ROUND_ROBIN, ACTIVITY_MODES.GROUP_KNOCKOUT])
  mode!: ActivityMode;

  @IsOptional()
  @IsISO8601()
  signupStartAt?: string;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsString()
  @MaxLength(40)
  locationName!: string;

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

  @IsInt()
  @Min(1)
  @Max(20)
  courtCount!: number;

  @IsInt()
  @Min(2)
  @Max(64)
  maxPlayers!: number;

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

/** 转为 Date 后的业务入参（服务层使用）。 */
export interface CreateActivityData {
  title?: string;
  level?: string;
  mode: ActivityMode;
  signupStartAt: Date;
  startAt: Date;
  endAt: Date;
  locationName: string;
  locationAddress: string;
  latitude?: number;
  longitude?: number;
  venue?: string;
  note?: string;
  courtCount: number;
  maxPlayers: number;
  warmupMinutes: number;
  matchRuleCode: MatchRuleCode;
  groupCount?: number;
  qualifyPerGroup?: number;
  enableThirdPlace?: boolean;
}

export function toCreateActivityData(dto: CreateActivityDto): CreateActivityData {
  return {
    ...dto,
    locationAddress: dto.locationAddress ?? '',
    signupStartAt: new Date(dto.signupStartAt ?? dto.startAt),
    startAt: new Date(dto.startAt),
    endAt: new Date(dto.endAt),
    warmupMinutes: dto.warmupMinutes ?? 10,
    matchRuleCode: dto.matchRuleCode ?? 'FOUR_GAMES_NO_AD',
  };
}
