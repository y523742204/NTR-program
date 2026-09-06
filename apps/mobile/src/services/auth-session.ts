import Taro from '@tarojs/taro';
import { USER_ROLES, type AuthSessionResponse, type AuthUserResponse } from '@ntr/shared';

import { getProfileOnboardingUrl } from './redirect-route';

const AUTH_SESSION_KEY = 'ntr.auth-session';
let cachedSession: AuthSessionResponse | null | undefined;

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

/** 订阅登录会话变化，返回取消订阅函数。 */
export function subscribeAuthSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifySessionChanged() {
  sessionListeners.forEach((listener) => listener());
}

function normalizeSession(session: AuthSessionResponse): AuthSessionResponse {
  const hasRequiredProfile = Boolean(
    session.user.name?.trim() && session.user.avatarUrl && session.user.gender,
  );
  const profileCompleted =
    typeof session.user.profileCompleted === 'boolean'
      ? session.user.profileCompleted && hasRequiredProfile
      : hasRequiredProfile;
  if (session.user.profileCompleted === profileCompleted && session.user.role) return session;
  return {
    ...session,
    user: {
      ...session.user,
      role: session.user.role ?? USER_ROLES.USER,
      profileCompleted,
    },
  };
}

/** 读取未过期的服务端会话，过期数据会立即清理。 */
export function getAuthSession(): AuthSessionResponse | null {
  if (cachedSession !== undefined) {
    if (!cachedSession || Date.parse(cachedSession.expiresAt) > Date.now()) return cachedSession;
    clearAuthSession();
    return null;
  }

  const session = Taro.getStorageSync<AuthSessionResponse | undefined>(AUTH_SESSION_KEY);
  if (session?.token && session.user && Date.parse(session.expiresAt) > Date.now()) {
    cachedSession = normalizeSession(session);
    if (cachedSession !== session) Taro.setStorageSync(AUTH_SESSION_KEY, cachedSession);
    return cachedSession;
  }
  cachedSession = null;
  if (session) Taro.removeStorageSync(AUTH_SESSION_KEY);
  return null;
}

export function isAdmin(): boolean {
  return getAuthSession()?.user.role === USER_ROLES.ADMIN;
}

/** 已登录但尚未完成首次资料时，阻止继续访问业务页面。 */
export function redirectIncompleteProfile(redirectRoute: string): boolean {
  const user = getAuthSession()?.user;
  if (!user || user.profileCompleted === true) return false;
  void Taro.reLaunch({ url: getProfileOnboardingUrl(redirectRoute) });
  return true;
}

/** 提供给 API 请求层使用的 Bearer 令牌。 */
export function getAuthToken(): string | null {
  return getAuthSession()?.token ?? null;
}

/** 保存后端完成微信校验后签发的会话。 */
export function saveAuthSession(session: AuthSessionResponse): void {
  Taro.setStorageSync(AUTH_SESSION_KEY, session);
  cachedSession = session;
  notifySessionChanged();
}

/** 使用服务端最新用户资料刷新本地会话。 */
export function saveAuthUser(user: AuthUserResponse): void {
  const session = getAuthSession();
  if (session) saveAuthSession({ ...session, user });
}

/** 删除当前设备的登录会话。 */
export function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_SESSION_KEY);
  cachedSession = null;
  notifySessionChanged();
}
