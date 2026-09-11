import Taro, { useReachBottom } from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useRef, useState } from 'react';

import { USER_ROLES, type AdminUserItemResponse, type AdminUserListResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { getAuthSession } from '../../services/auth-session';
import { requireLogin } from '../../services/guard';
import { formatDate } from '../../utils/format';

import { THEME_COLOR } from '../../constants/theme';
import UserAvatar from '../../components/user-avatar';

import './index.scss';

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [ready, setReady] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [summary, setSummary] = useState<AdminUserListResponse['summary']>({
    totalUsers: 0,
    adminCount: 0,
  });
  const [items, setItems] = useState<AdminUserItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const seqRef = useRef(0);

  const loadPage = useCallback(
    async (targetPage: number, append: boolean) => {
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        const data = await apiRequest<AdminUserListResponse>({
          path: `/auth/admin/users?keyword=${encodeURIComponent(keyword)}&page=${targetPage}&pageSize=${PAGE_SIZE}`,
        });
        if (seq !== seqRef.current) return;
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setSummary(data.summary);
        setPage(targetPage);
      } catch {
        if (seq === seqRef.current) void Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [keyword],
  );

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      requireLogin();
      return;
    }
    if (session.user.role !== USER_ROLES.ADMIN) {
      void Taro.navigateBack({ fail: () => void Taro.reLaunch({ url: '/pages/index/index' }) });
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) void loadPage(1, false);
  }, [ready, loadPage]);

  useReachBottom(() => {
    if (ready && !loading && items.length < total) void loadPage(page + 1, true);
  });

  function onSearch() {
    const kw = searchText.trim();
    if (kw !== keyword) setKeyword(kw);
  }

  async function promoteAdmin(user: AdminUserItemResponse) {
    if (busyUserId) return;
    const modal = await Taro.showModal({
      title: '设为管理员',
      content: `确认将「${user.name}」设为管理员？`,
      confirmColor: THEME_COLOR.PRIMARY,
    });
    if (!modal.confirm) return;
    setBusyUserId(user.userId);
    try {
      await apiRequest<void>({
        path: '/auth/admin',
        method: 'POST',
        data: { userId: user.userId },
      });
      void Taro.showToast({ title: '已设为管理员', icon: 'success' });
      await loadPage(1, false);
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '操作失败',
        icon: 'none',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function revokeAdmin(user: AdminUserItemResponse) {
    if (busyUserId) return;
    setBusyUserId(user.userId);
    try {
      await apiRequest<void>({ path: `/auth/admin/${user.userId}`, method: 'DELETE' });
      void Taro.showToast({ title: '已撤销管理员', icon: 'success' });
      await loadPage(1, false);
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '操作失败',
        icon: 'none',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  if (!ready) return null;

  function roleAction(user: AdminUserItemResponse) {
    return user.role === USER_ROLES.ADMIN ? (
      <Text
        className="ntr-btn ntr-btn--danger ntr-btn--sm au-user__action"
        onClick={() => void revokeAdmin(user)}
      >
        撤销管理
      </Text>
    ) : (
      <Text
        className="ntr-btn ntr-btn--ghost ntr-btn--sm au-user__action"
        onClick={() => void promoteAdmin(user)}
      >
        设为管理员
      </Text>
    );
  }

  return (
    <View className="ntr-page au-page">
      <View className="ntr-card au-summary">
        <View className="au-stat">
          <Text className="au-stat__num">{summary.totalUsers}</Text>
          <Text className="ntr-text-3 au-stat__label">总用户</Text>
        </View>
        <View className="au-stat__divider" />
        <View className="au-stat">
          <Text className="au-stat__num au-stat__num--accent">{summary.adminCount}</Text>
          <Text className="ntr-text-3 au-stat__label">管理员</Text>
        </View>
      </View>

      <Input
        className="ntr-input au-search"
        value={searchText}
        placeholder="搜索用户昵称"
        placeholderClass="ntr-input__placeholder"
        confirmType="search"
        onInput={(e) => setSearchText(e.detail.value)}
        onConfirm={() => onSearch()}
      />

      <View className="ntr-card au-list">
        {items.length === 0 && loading && (
          <View className="ntr-empty">
            <Text className="ntr-empty__text">加载中</Text>
          </View>
        )}
        {items.length === 0 && !loading && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">▢</View>
            <Text className="ntr-empty__text">暂无用户</Text>
          </View>
        )}
        {items.map((user) => (
          <View key={user.userId} className="ntr-row au-user">
            <View className="au-user__main">
              <UserAvatar
                userId={user.userId}
                name={user.name}
                avatarUrl={user.avatarUrl}
                className="au-user__avatar"
              />
              <View className="au-user__info">
                <View className="au-user__line">
                  <Text className="au-user__name">{user.name}</Text>
                  {user.role === USER_ROLES.ADMIN ? (
                    <Text className="ntr-tag ntr-tag--accent">管理员</Text>
                  ) : (
                    <Text className="ntr-tag ntr-tag--muted">球友</Text>
                  )}
                </View>
                <Text className="ntr-text-3 au-user__date">{formatDate(user.createdAt)} 注册</Text>
              </View>
            </View>
            {roleAction(user)}
          </View>
        ))}
        {items.length > 0 && (
          <View className="au-list__foot">
            <Text className="ntr-text-3">
              {items.length >= total ? '没有更多了' : '上拉加载更多…'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
