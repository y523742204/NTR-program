import Taro from '@tarojs/taro';

import { getAuthSession, redirectIncompleteProfile } from './auth-session';
import { getCurrentPageUrl } from './redirect-route';

/** 未登录时跳转登录页，返回是否已登录。 */
export function requireLogin(): boolean {
  if (getAuthSession()) return true;
  const redirect = encodeURIComponent(getCurrentPageUrl());
  void Taro.navigateTo({ url: `/pages/login/index?redirect=${redirect}` });
  return false;
}

/** 已登录但资料未补全时跳转补全页，返回是否可以继续业务操作。 */
export function requireProfile(): boolean {
  return !redirectIncompleteProfile(getCurrentPageUrl());
}
