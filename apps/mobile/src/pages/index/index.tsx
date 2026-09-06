import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useState } from 'react';

import type { ActivityListItemResponse, ActivityListResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { syncHomeTabBar } from '../../services/tab-navigation';
import { formatRange, getActivityPhase, modeLabel, PHASE_LABEL } from '../../utils/format';

import './index.scss';

type PhaseFilter = 'ALL' | 'UPCOMING' | 'ONGOING' | 'FINISHED';
type ModeFilter = 'ALL' | 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';

const PHASE_FILTERS: { value: PhaseFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'UPCOMING', label: '未开始' },
  { value: 'ONGOING', label: '进行中' },
  { value: 'FINISHED', label: '已结束' },
];

const MODE_FILTERS: { value: ModeFilter; label: string }[] = [
  { value: 'ALL', label: '全部赛制' },
  { value: 'ROUND_ROBIN', label: '单循环' },
  { value: 'GROUP_KNOCKOUT', label: '小组+淘汰' },
];

const PAGE_SIZE = 10;

function ActivityCard({ activity }: { activity: ActivityListItemResponse }) {
  const phase = getActivityPhase(activity.startAt, activity.endAt);
  const percent =
    activity.maxPlayers > 0
      ? Math.min(100, Math.round((activity.signupCount / activity.maxPlayers) * 100))
      : 0;
  const full = activity.signupCount >= activity.maxPlayers && activity.maxPlayers > 0;
  return (
    <View
      className="act-card"
      onClick={() =>
        void Taro.navigateTo({ url: `/pages/activity-detail/index?id=${activity.id}` })
      }
    >
      <View className="act-card__top">
        <Text className="ntr-tag ntr-tag--primary">{modeLabel(activity.mode)}</Text>
        <Text
          className={`ntr-tag ${
            phase === 'FINISHED'
              ? 'ntr-tag--muted'
              : phase === 'ONGOING'
                ? 'ntr-tag--accent'
                : 'ntr-tag--primary'
          }`}
        >
          {PHASE_LABEL[phase]}
        </Text>
        {activity.schedulePublished && (
          <Text className="ntr-tag ntr-tag--muted act-card__published">赛程已发布</Text>
        )}
        <Text className={`act-card__count ${full ? 'act-card__count--full' : ''}`}>
          {activity.signupCount}/{activity.maxPlayers} 人
        </Text>
      </View>
      <Text className="act-card__title">{activity.title}</Text>
      <View className="act-card__meta">
        <Text className="act-card__meta-icon">◷</Text>
        <Text className="act-card__meta-text">{formatRange(activity.startAt, activity.endAt)}</Text>
      </View>
      <View className="act-card__meta">
        <Text className="act-card__meta-icon">◎</Text>
        <Text className="act-card__meta-text">{activity.locationName}</Text>
        <Text className="act-card__meta-courts">{activity.courtCount} 片场地</Text>
      </View>
      <View className="act-card__progress">
        <View className="act-card__progress-inner" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}

export default function IndexPage() {
  const [phase, setPhase] = useState<PhaseFilter>('ALL');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [items, setItems] = useState<ActivityListItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      try {
        const query = [
          `page=${targetPage}`,
          `pageSize=${PAGE_SIZE}`,
          `status=${phase}`,
          ...(mode === 'ALL' ? [] : [`mode=${mode}`]),
        ].join('&');
        const data = await apiRequest<ActivityListResponse>({ path: `/activities?${query}` });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setPage(targetPage);
      } catch {
        void Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [mode, phase],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [phase, mode]);

  useDidShow(() => {
    syncHomeTabBar('activities');
  });

  usePullDownRefresh(() => {
    void fetchPage(1, false).finally(() => Taro.stopPullDownRefresh());
  });

  useReachBottom(() => {
    if (!loading && items.length < total) {
      void fetchPage(page + 1, true);
    }
  });

  return (
    <View className="ntr-page index-page">
      <View className="index-hero">
        <View className="index-hero__logo">
          <View className="index-hero__brand">
            <Text className="index-hero__brand-ntr">NTR</Text>
            <View className="index-hero__brand-dot" />
          </View>
          <Text className="index-hero__tagline">单打网球赛事 · 循环与淘汰</Text>
        </View>
        <View className="index-hero__line" />
      </View>

      <View className="index-filters">
        <View className="ntr-seg index-filters__row">
          {PHASE_FILTERS.map((item) => (
            <View
              key={item.value}
              className={`ntr-seg__item ${phase === item.value ? 'ntr-seg__item--active' : ''}`}
              onClick={() => setPhase(item.value)}
            >
              {item.label}
            </View>
          ))}
        </View>
        <View className="ntr-seg index-filters__row">
          {MODE_FILTERS.map((item) => (
            <View
              key={item.value}
              className={`ntr-seg__item ${mode === item.value ? 'ntr-seg__item--active' : ''}`}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </View>
          ))}
        </View>
      </View>

      <View className="index-list">
        {initialLoading && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">…</View>
            <Text className="ntr-empty__text">正在加载赛事</Text>
          </View>
        )}
        {!initialLoading && items.length === 0 && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">▢</View>
            <Text className="ntr-empty__text">暂无符合条件的赛事</Text>
          </View>
        )}
        {items.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
        {!initialLoading && items.length > 0 && (
          <View className="index-list__foot">
            <Text className="ntr-text-3">
              {items.length >= total && total > 0 ? '没有更多了' : '上拉加载更多…'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
