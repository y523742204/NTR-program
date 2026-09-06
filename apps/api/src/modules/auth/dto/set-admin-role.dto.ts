import { IsString } from 'class-validator';

export class SetAdminRoleDto {
  @IsString()
  userId!: string;
}
