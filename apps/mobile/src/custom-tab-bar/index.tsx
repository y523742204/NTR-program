import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { Component } from 'react';

import { getAuthSession, subscribeAuthSession } from '../services/auth-session';
import { HOME_TABS, type HomeTab } from '../services/tab-navigation';

import './index.scss';

interface HomeTabBarState {
  activeTab: HomeTab;
  canPublish: boolean;
}

function getActiveTab(): HomeTab {
  const pages = Taro.getCurrentPages();
  const route = pages[pages.length - 1]?.route;
  return route === HOME_TABS.profile.slice(1) ? 'profile' : 'activities';
}

function isAdminUser(): boolean {
  return getAuthSession()?.user.role === 'ADMIN';
}

export default class CustomTabBar extends Component<object, HomeTabBarState> {
  static options = { addGlobalClass: true };

  state: HomeTabBarState = {
    activeTab: getActiveTab(),
    canPublish: isAdminUser(),
  };

  private unsubscribeAuth?: () => void;

  componentDidMount() {
    this.unsubscribeAuth = subscribeAuthSession(() => {
      this.setState({ canPublish: isAdminUser() });
    });
  }

  componentWillUnmount() {
    this.unsubscribeAuth?.();
  }

  setTabBarState = (activeTab: HomeTab) => {
    this.setState({ activeTab });
  };

  render() {
    const { activeTab, canPublish } = this.state;
    return (
      <View className="ntr-tabbar">
        <View
          className={`ntr-tabbar__item ${activeTab === 'activities' ? 'ntr-tabbar__item--active' : ''}`}
          onClick={() => void Taro.switchTab({ url: HOME_TABS.activities })}
        >
          <View className="ntr-tabbar__icon ntr-tabbar__icon--courts" />
          <Text className="ntr-tabbar__label">赛事</Text>
        </View>
        {canPublish && (
          <View
            className="ntr-tabbar__publish"
            onClick={() => void Taro.navigateTo({ url: '/pages/activity-create/index' })}
          >
            <Text className="ntr-tabbar__publish-plus">+</Text>
          </View>
        )}
        <View
          className={`ntr-tabbar__item ${activeTab === 'profile' ? 'ntr-tabbar__item--active' : ''}`}
          onClick={() => void Taro.switchTab({ url: HOME_TABS.profile })}
        >
          <View className="ntr-tabbar__icon ntr-tabbar__icon--user" />
          <Text className="ntr-tabbar__label">我的</Text>
        </View>
      </View>
    );
  }
}
