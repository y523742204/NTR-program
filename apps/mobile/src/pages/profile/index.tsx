import Taro, { useDidShow } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useCallback, useState } from 'react';

import type { AuthUserResponse } from '@ntr/shared';

import { apiRequest, resolveApiAssetUrl } from '../../services/api';
import {
  clearAuthSession,
  getAuthSession,
  isAdmin,
  subscribeAuthSession,
} from '../../services/auth-session';
import { refreshCurrentUser } from '../../services/current-user';
import { HOME_TABS, switchHomeTab } from '../../services/tab-navigation';

import './index.scss';

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUserResponse | null>(() => getAuthSession()?.user ?? null);

  const hydrate = useCallback(() => {
    setUser(getAuthSession()?.user ?? null);
  }, []);

  useDidShow(() => {
    void refreshCurrentUser(true).then((fresh) => setUser(fresh ?? getAuthSession()?.user ?? null));
  });

  subscribeAuthSession(hydrate);

  const roleTag = isAdmin() ? '管理员' : '球友';
  const roleClass = isAdmin() ? 'ntr-tag--accent' : 'ntr-tag--muted';
  const avatarText = (user?.name?.trim() || '?').slice(0, 1);
  const maskedPhone = user ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '';

  function go(url: string) {
    void Taro.navigateTo({ url });
  }

  async function handleLogout() {
    const modal = await Taro.showModal({
      title: '退出登录',
      content: '确认退出当前账号？',
      confirmColor: '#FF5C5B',
    });
    if (!modal.confirm) return;
    try {
      await apiRequest({ path: '/auth/session', method: 'DELETE' });
    } finally {
      clearAuthSession();
      void Taro.showToast({ title: '已退出登录', icon: 'none' });
      void switchHomeTab(HOME_TABS.activities);
    }
  }

  if (!user) {
    return (
      <View className="ntr-page">
        <View className="ntr-empty">
          <View className="ntr-empty__icon">◌</View>
          <Text className="ntr-empty__text">未登录</Text>
        </View>
      </View>
    );
  }

  const functionRows = [
    { label: '我的报名', value: '', url: '/pages/signup-records/index' },
    { label: '我的战绩', value: '', url: '/pages/my-matches/index' },
  ];

  const adminRows = [
    { label: '发布赛事', value: '', url: '/pages/activity-create/index' },
    { label: '用户管理', value: '', url: '/pages/admin-users/index' },
    { label: '赛事列表', value: '', url: HOME_TABS.activities },
  ];

  return (
    <View className="ntr-page profile-page">
      <View className="ntr-card ntr-card--padded">
        <View className="profile-head">
          <View className="ntr-avatar profile-head__avatar">
            {user.avatarUrl ? (
              <Image src={resolveApiAssetUrl(user.avatarUrl)} mode="aspectFill" />
            ) : (
              <Text>{avatarText}</Text>
            )}
          </View>
          <View className="profile-head__info">
            <View className="profile-head__name-row">
              <Text className="profile-head__name">{user.name?.trim() || '未设置昵称'}</Text>
              <Text className={`ntr-tag ${roleClass}`}>{roleTag}</Text>
            </View>
            <Text className="profile-head__phone">{maskedPhone}</Text>
          </View>
          {user.profileCompleted === false && (
            <View
              className="ntr-btn ntr-btn--primary ntr-btn--sm profile-head__btn"
              onClick={() => go('/pages/profile-detail/index')}
            >
              <Text>完善资料</Text>
            </View>
          )}
        </View>
      </View>

      <View className="profile-group">
        {functionRows.map((row) => (
          <View key={row.label} className="ntr-row" onClick={() => go(row.url)}>
            <Text className="ntr-row__label">{row.label}</Text>
            <Text className="profile-row__arrow">›</Text>
          </View>
        ))}
      </View>

      {isAdmin() && (
        <View className="profile-group">
          {adminRows.map((row) => (
            <View key={row.label} className="ntr-row" onClick={() => go(row.url)}>
              <Text className="ntr-row__label">{row.label}</Text>
              <Text className="profile-row__arrow">›</Text>
            </View>
          ))}
        </View>
      )}

      <View className="ntr-btn ntr-btn--danger profile-logout" onClick={() => void handleLogout()}>
        <Text>退出登录</Text>
      </View>
    </View>
  );
}
