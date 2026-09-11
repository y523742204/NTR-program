import type { ActivitySignupResponse } from '@ntr/shared';

import type { ActivitySignup } from '../../generated/prisma/client';

type SignupWithUser = ActivitySignup & {
  user?: { id?: string | null; avatarUrl?: string | null } | null;
};

export function mapSignupResponse(
  signup: SignupWithUser,
  meUserId?: string | null,
): ActivitySignupResponse {
  return {
    id: signup.id,
    userId: signup.userId,
    participantName: signup.participantName,
    avatarUrl: signup.user?.avatarUrl ?? null,
    gender: signup.gender,
    status: signup.status,
    isMe: Boolean(signup.userId && signup.userId === meUserId),
    createdAt: signup.createdAt.toISOString(),
  };
}
