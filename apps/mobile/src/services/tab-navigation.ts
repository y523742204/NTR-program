import Taro from '@tarojs/taro';

export const HOME_TABS = {
  activities: '/pages/index/index',
  profile: '/pages/profile/index',
} as const;

export type HomeTab = keyof typeof HOME_TABS;
export type HomeTabRoute = (typeof HOME_TABS)[keyof typeof HOME_TABS];

interface HomeTabBarController {
  setTabBarState: (activeTab: HomeTab, canPublish?: boolean) => void;
}

export function isHomeTabRoute(route: string): route is HomeTabRoute {
  const path = route.split('?')[0];
  return Object.values(HOME_TABS).includes(path as HomeTabRoute);
}

export function switchHomeTab(route: HomeTabRoute) {
  return Taro.switchTab({ url: route });
}

export function syncHomeTabBar(activeTab: HomeTab): void {
  const page = Taro.getCurrentInstance().page;
  if (!page) return;
  Taro.getTabBar<HomeTabBarController>(page)?.setTabBarState(activeTab);
}
