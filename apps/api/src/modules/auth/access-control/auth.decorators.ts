import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@ntr/shared';

export const PUBLIC_ROUTE_KEY = 'auth.public';
export const OPTIONAL_AUTH_ROUTE_KEY = 'auth.optional';
export const ALLOW_INCOMPLETE_PROFILE_KEY = 'auth.allow-incomplete-profile';
export const REQUIRED_ROLES_KEY = 'auth.required-roles';
export const ACTIVITY_OWNER_KEY = 'auth.activity-owner';

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_ROUTE_KEY, true);
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
export const RequireActivityOwner = () => SetMetadata(ACTIVITY_OWNER_KEY, true);
