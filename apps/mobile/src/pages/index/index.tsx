import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { Clock, Location } from '@taroify/icons';
import { useCallback, useEffect, useState } from 'react';

import type { ActivityListItemResponse, ActivityListResponse } from '@ntr/shared';

import { apiRequest, resolveApiAssetUrl } from '../../services/api';
import { syncHomeTabBar } from '../../services/tab-navigation';
import { formatRange, getActivityPhase, modeLabel, PHASE_LABEL } from '../../utils/format';

import './index.scss';

type PhaseFilter = 'ALL' | 'UPCOMING' | 'ONGOING' | 'FINISHED';
type ModeFilter = 'ALL' | 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';

const PHASE_FILTERS: { value: PhaseFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'UPCOMING', label: '报名中' },
  { value: 'ONGOING', label: '进行中' },
  { value: 'FINISHED', label: '已结束' },
];

const MODE_FILTERS: { value: ModeFilter; label: string }[] = [
  { value: 'ALL', label: '全部赛制' },
  { value: 'ROUND_ROBIN', label: '循环赛' },
  { value: 'GROUP_KNOCKOUT', label: '淘汰赛' },
];

const PAGE_SIZE = 10;

function ActivityCard({ activity }: { activity: ActivityListItemResponse }) {
  const phase = getActivityPhase(activity.startAt, activity.endAt);
  const full = activity.signupCount >= activity.maxPlayers && activity.maxPlayers > 0;
  const statusClass =
    phase === 'FINISHED'
      ? 'act-card__status--finished'
      : phase === 'ONGOING'
        ? 'act-card__status--ongoing'
        : 'act-card__status--upcoming';
  const actionLabel = phase === 'UPCOMING' ? '报名中' : phase === 'ONGOING' ? '进行中' : '已结束';
  const actionClass = phase === 'FINISHED' ? 'act-card__action--muted' : '';

  return (
    <View
      className="act-card"
      hoverClass="ntr-hover"
      onClick={() =>
        void Taro.navigateTo({ url: `/pages/activity-detail/index?id=${activity.id}` })
      }
    >
      <View className="act-card__main">
        <View className="act-card__cover">
          {activity.coverImageUrl ? (
            <Image
              className="act-card__cover-img"
              src={resolveApiAssetUrl(activity.coverImageUrl)}
              mode="aspectFill"
            />
          ) : (
            <View className="act-card__cover-placeholder">
              <Text className="act-card__cover-text">
                {activity.level ? `【${activity.level}】` : ''}
                {modeLabel(activity.mode)}
              </Text>
            </View>
          )}
          <View className="act-card__cover-shade" />
          <Text className={`act-card__status ${statusClass}`}>{PHASE_LABEL[phase]}</Text>
        </View>
        <View className="act-card__info">
          <Text className="act-card__title">{activity.title}</Text>
          <View className="act-card__tags">
            <Text className="act-card__tag act-card__tag--mode">{modeLabel(activity.mode)}</Text>
            {activity.schedulePublished && (
              <Text className="act-card__tag act-card__tag--muted">赛程已发布</Text>
            )}
          </View>
          <View className="act-card__meta">
            <Clock className="act-card__meta-icon" size="22" />
            <Text className="act-card__meta-text">
              {formatRange(activity.startAt, activity.endAt)}
            </Text>
          </View>
          <View className="act-card__meta">
            <Location className="act-card__meta-icon" size="22" />
            <Text className="act-card__meta-text">{activity.locationName}</Text>
            <Text className="act-card__meta-courts">{activity.courtCount} 片场地</Text>
          </View>
        </View>
      </View>
      <View className="act-card__foot">
        <Text className={`act-card__count ${full ? 'act-card__count--full' : ''}`}>
          {activity.signupCount}/{activity.maxPlayers} 人
        </Text>
        <View className={`act-card__action ${actionClass}`}>
          <Text>{actionLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View className="act-card act-card--skeleton">
      <View className="act-card__main">
        <View className="act-card__cover act-card__cover--skeleton" />
        <View className="act-card__info">
          <View className="skeleton-line skeleton-line--title" />
          <View className="skeleton-line" />
          <View className="skeleton-line skeleton-line--short" />
        </View>
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
        <View className="index-hero__banner">
          <View className="index-hero__brand">
            <Text className="index-hero__brand-ntr">NTR</Text>
          </View>
          <Text className="index-hero__tagline">NYG网球赛事平台</Text>
        </View>
      </View>

      <View className="index-tabs">
        {PHASE_FILTERS.map((item) => (
          <View
            key={item.value}
            className={`index-tabs__item ${phase === item.value ? 'index-tabs__item--active' : ''}`}
            onClick={() => setPhase(item.value)}
          >
            {item.label}
          </View>
        ))}
      </View>

      <View className="index-chips">
        {MODE_FILTERS.map((item) => (
          <View
            key={item.value}
            className={`index-chips__item ${
              mode === item.value ? 'index-chips__item--active' : ''
            }`}
            onClick={() => setMode(item.value)}
          >
            {item.label}
          </View>
        ))}
      </View>

      <View className="index-list">
        {initialLoading && (
          <View>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
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
