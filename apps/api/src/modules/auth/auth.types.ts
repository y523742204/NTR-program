import type { Request } from 'express';
import type { ParticipantGender, UserRole } from '@ntr/shared';

export interface AuthenticatedUser {
  id: string;
  createdAt: string;
  name: string | null;
  phone: string;
  avatarUrl: string | null;
  gender: ParticipantGender | null;
  role: UserRole;
  profileCompleted: boolean;
}

export interface AuthenticatedSession {
  sessionId: string;
  user: AuthenticatedUser;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthenticatedSession;
}

export interface OptionallyAuthenticatedRequest extends Request {
  auth?: AuthenticatedSession;
}
