import type { AuthUserResponse } from '@ntr/shared';

import { ApiError, apiRequest } from './api';
import { clearAuthSession, getAuthSession, saveAuthUser } from './auth-session';

const USER_REFRESH_INTERVAL = 60_000;
let lastRefreshUserId = '';
let lastRefreshAt = 0;
let pendingRefresh: {
  userId: string;
  request: Promise<AuthUserResponse | null>;
} | null = null;

export async function refreshCurrentUser(force = false): Promise<AuthUserResponse | null> {
  const session = getAuthSession();
  if (!session) return null;
  if (
    !force &&
    session.user.id === lastRefreshUserId &&
    Date.now() - lastRefreshAt < USER_REFRESH_INTERVAL
  ) {
    return session.user;
  }
  if (pendingRefresh?.userId === session.user.id) return pendingRefresh.request;

  const request = (async () => {
    try {
      const user = await apiRequest<AuthUserResponse>({ path: '/auth/me' });
      if (getAuthSession()?.user.id !== session.user.id) return getAuthSession()?.user ?? null;
      saveAuthUser(user);
      lastRefreshUserId = user.id;
      lastRefreshAt = Date.now();
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        if (getAuthSession()?.user.id !== session.user.id) return getAuthSession()?.user ?? null;
        clearAuthSession();
        lastRefreshUserId = '';
        lastRefreshAt = 0;
        return null;
      }
      return getAuthSession()?.user ?? null;
    }
  })();
  pendingRefresh = { userId: session.user.id, request };
  try {
    return await request;
  } finally {
    if (pendingRefresh?.request === request) pendingRefresh = null;
  }
}
