import { IsIn, IsOptional, IsString } from 'class-validator';
import { USER_ROLES, type UserRole } from '@ntr/shared';

export class DevLoginDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn([USER_ROLES.USER, USER_ROLES.ADMIN])
  role?: UserRole;
}
