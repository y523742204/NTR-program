import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useState } from 'react';

import type { MySignupListResponse, MySignupRecordResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { requireLogin } from '../../services/guard';
import {
  formatRange,
  getActivityPhase,
  modeLabel,
  PHASE_LABEL,
  type ActivityPhase,
} from '../../utils/format';

import './index.scss';

const PAGE_SIZE = 10;

function phaseTone(phase: ActivityPhase): string {
  if (phase === 'FINISHED') return 'ntr-tag--muted';
  if (phase === 'ONGOING') return 'ntr-tag--accent';
  return 'ntr-tag--primary';
}

function SignupCard({ record }: { record: MySignupRecordResponse }) {
  const phase = getActivityPhase(record.startAt, record.endAt);
  return (
    <View
      className="ntr-card sr-card"
      onClick={() =>
        void Taro.navigateTo({ url: `/pages/activity-detail/index?id=${record.activityId}` })
      }
    >
      <View className="sr-card__head">
        <Text className="ntr-tag ntr-tag--primary">{modeLabel(record.mode)}</Text>
        <Text className={`ntr-tag ${phaseTone(phase)}`}>{PHASE_LABEL[phase]}</Text>
        {record.signupStatus === 'WAITLISTED' && (
          <Text className="ntr-tag ntr-tag--danger">候补中</Text>
        )}
      </View>
      <Text className="sr-card__title">{record.activityTitle}</Text>
      <View className="sr-card__meta">
        <Text className="sr-card__meta-icon">◷</Text>
        <Text>{formatRange(record.startAt, record.endAt)}</Text>
      </View>
      <View className="sr-card__meta">
        <Text className="sr-card__meta-icon">◎</Text>
        <Text>{record.locationName}</Text>
      </View>
      <View className="sr-card__foot">
        <Text className="ntr-text-3">
          {record.signupStatus === 'CONFIRMED' ? '已报名' : '等待补位'}
        </Text>
        <Text className="sr-card__go">查看 ›</Text>
      </View>
    </View>
  );
}

export default function SignupRecordsPage() {
  const [items, setItems] = useState<MySignupRecordResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPage = useCallback(async (targetPage: number, append: boolean) => {
    setLoading(true);
    try {
      const data = await apiRequest<MySignupListResponse>({
        path: `/activities/signups/me?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      });
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
      setPage(targetPage);
    } catch {
      void Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useDidShow(() => {
    if (!requireLogin()) return;
    void fetchPage(1, false);
  });

  useReachBottom(() => {
    if (!loading && items.length < total) void fetchPage(page + 1, true);
  });

  return (
    <View className="ntr-page">
      <View className="signups-list">
        {initialLoading && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">…</View>
            <Text className="ntr-empty__text">加载中</Text>
          </View>
        )}
        {!initialLoading && items.length === 0 && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">▢</View>
            <Text className="ntr-empty__text">暂无报名记录</Text>
          </View>
        )}
        {items.map((record) => (
          <SignupCard key={record.signupId} record={record} />
        ))}
        {!initialLoading && items.length > 0 && (
          <View className="signups-list__foot">
            <Text className="ntr-text-3">
              {items.length >= total && total > 0 ? '没有更多了' : '上拉加载更多…'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
