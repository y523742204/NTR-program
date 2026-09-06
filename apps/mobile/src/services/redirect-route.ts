import Taro from '@tarojs/taro';

interface RouteParams {
  onboarding?: string | string[];
  redirect?: string | string[];
}

/** Taro 运行时注入页面的内部参数，不应拼入回跳 URL。 */
const TARO_INTERNAL_PARAMS = new Set(['__key_', '$taroTimestamp']);

function getRouteParams(): RouteParams {
  return (
    (
      Taro.getCurrentInstance().router as
        | {
            params?: RouteParams;
          }
        | undefined
    )?.params ?? {}
  );
}

function getFirstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getCurrentRedirectRoute(): string | undefined {
  const route = getFirstParam(getRouteParams().redirect);
  if (!route) return undefined;
  try {
    const decodedRoute = decodeURIComponent(route);
    return /^\/pages\/[a-z0-9-/]+(?:\?[^#]*)?$/i.test(decodedRoute) ? decodedRoute : undefined;
  } catch {
    return undefined;
  }
}

/** 拼出当前页面完整路径（含 query），用于登录后回跳。 */
export function getCurrentPageUrl(): string {
  const router = Taro.getCurrentInstance().router;
  if (!router?.path) return '';
  const query = Object.entries(router.params ?? {})
    .filter(([key]) => !TARO_INTERNAL_PARAMS.has(key))
    .map(([key, value]) => {
      const rawValue = (value as string | string[] | undefined) ?? '';
      const item = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`;
    })
    .join('&');
  return query ? `${router.path}?${query}` : router.path;
}

export function isProfileOnboarding(): boolean {
  return getFirstParam(getRouteParams().onboarding) === '1';
}

export function getProfileOnboardingUrl(redirectRoute: string): string {
  return `/pages/profile-detail/index?onboarding=1&redirect=${encodeURIComponent(redirectRoute)}`;
}
