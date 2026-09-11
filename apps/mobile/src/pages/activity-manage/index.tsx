import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useState } from 'react';

import type { ActivityDetailResponse, ScheduleResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { getActivityPhase, PHASE_LABEL } from '../../utils/format';

import { THEME_COLOR } from '../../constants/theme';

import './index.scss';

type StatusVariant = 'primary' | 'muted' | 'danger';

function statusMeta(detail: ActivityDetailResponse): { label: string; variant: StatusVariant } {
  if (detail.status === 'CANCELED') return { label: '已取消', variant: 'danger' };
  const phase = getActivityPhase(detail.startAt, detail.endAt);
  const variant: StatusVariant = phase === 'ONGOING' ? 'primary' : 'muted';
  return { label: PHASE_LABEL[phase], variant };
}

export default function ActivityManagePage() {
  const activityId = Taro.getCurrentInstance().router?.params?.id as string;
  const [detail, setDetail] = useState<ActivityDetailResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    const data = await apiRequest<ActivityDetailResponse>({ path: `/activities/${activityId}` });
    setDetail(data);
    return data;
  }, [activityId]);

  const loadSchedule = useCallback(async () => {
    const data = await apiRequest<ScheduleResponse>({
      path: `/activities/${activityId}/schedule`,
    });
    setSchedule(data);
    return data;
  }, [activityId]);

  const refresh = useCallback(async () => {
    await Promise.all([loadDetail(), loadSchedule()]);
  }, [loadDetail, loadSchedule]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useDidShow(() => {
    if (detail) void loadDetail();
  });

  const genSchedule = useCallback(
    async (path: 'schedule' | 'schedule/regenerate', confirmText?: string) => {
      if (confirmText) {
        const modal = await Taro.showModal({
          title: '重新生成赛程',
          content: confirmText,
          confirmColor: THEME_COLOR.DANGER,
        });
        if (!modal.confirm) return;
      }
      try {
        await apiRequest<void>({ path: `/activities/${activityId}/${path}`, method: 'POST' });
        void Taro.showToast({ title: '赛程已生成', icon: 'success' });
        await refresh();
      } catch (err) {
        void Taro.showToast({
          title: (err as { message?: string }).message ?? '操作失败',
          icon: 'none',
        });
      }
    },
    [activityId, refresh],
  );

  const publishSchedule = useCallback(async () => {
    try {
      await apiRequest<void>({
        path: `/activities/${activityId}/schedule/publish`,
        method: 'POST',
      });
      void Taro.showToast({ title: '赛程已发布', icon: 'success' });
      await refresh();
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '操作失败',
        icon: 'none',
      });
    }
  }, [activityId, refresh]);

  const removeSignup = useCallback(
    async (signupId: string) => {
      const modal = await Taro.showModal({
        title: '移除该报名',
        content: '确认将该选手移出本次赛事？',
        confirmColor: THEME_COLOR.DANGER,
      });
      if (!modal.confirm) return;
      try {
        await apiRequest<void>({
          path: `/activities/${activityId}/signups/${signupId}`,
          method: 'DELETE',
        });
        void Taro.showToast({ title: '已移除', icon: 'success' });
        await refresh();
      } catch (err) {
        void Taro.showToast({
          title: (err as { message?: string }).message ?? '操作失败',
          icon: 'none',
        });
      }
    },
    [activityId, refresh],
  );

  if (loading || !detail) {
    return (
      <View className="ntr-empty">
        <Text className="ntr-empty__text">加载中</Text>
      </View>
    );
  }

  const phase = statusMeta(detail);
  const hasRounds = Boolean(schedule && schedule.rounds.length > 0);
  const published = Boolean(schedule?.published);
  const totalMatches =
    (schedule?.rounds.reduce((sum, r) => sum + r.matches.length, 0) ?? 0) +
    (schedule?.knockout.length ?? 0) +
    (schedule?.thirdPlace ? 1 : 0);
  const roundCount = schedule?.rounds.length ?? 0;
  const confirmedCount = detail.signups.filter((s) => s.status === 'CONFIRMED').length;

  return (
    <View className="ntr-page am-page">
      <View className="ntr-card am-head">
        <View className="am-head__row">
          <Text className="am-head__title">{detail.title}</Text>
          <Text className={`ntr-tag ntr-tag--${phase.variant}`}>{phase.label}</Text>
          <Text
            className="am-head__edit"
            onClick={() =>
              void Taro.navigateTo({ url: `/pages/activity-create/index?id=${activityId}` })
            }
          >
            编辑 ›
          </Text>
        </View>
        <View className="am-head__count">
          <Text className="am-head__stat">
            已报名 {detail.signupCount}/{detail.maxPlayers}人
          </Text>
          {detail.waitlistedCount > 0 && (
            <Text className="ntr-tag ntr-tag--warn">候补 {detail.waitlistedCount} 人</Text>
          )}
        </View>
      </View>

      <View className="ntr-card am-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">报名名单</Text>
          <Text className="ntr-section-title__extra">确认 {confirmedCount} 人</Text>
        </View>
        {detail.signups.length === 0 && <Text className="ntr-text-3 am-empty">暂无报名</Text>}
        {detail.signups.map((signup) => (
          <View key={signup.id} className="am-row">
            <View className="am-row__name">
              <Text className="am-row__text">{signup.participantName}</Text>
              {signup.status === 'WAITLISTED' && (
                <Text className="ntr-tag ntr-tag--warn">候补</Text>
              )}
              {signup.isMe && <Text className="ntr-tag ntr-tag--primary">我</Text>}
            </View>
            {signup.userId && (
              <Text
                className="ntr-btn ntr-btn--danger ntr-btn--sm"
                onClick={() => void removeSignup(signup.id)}
              >
                移除
              </Text>
            )}
          </View>
        ))}
      </View>

      <View className="ntr-card am-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">赛程操作</Text>
        </View>
        {!hasRounds && (
          <View
            className="ntr-btn ntr-btn--primary am-action"
            onClick={() => void genSchedule('schedule')}
          >
            <Text>生成赛程</Text>
          </View>
        )}
        {hasRounds && !published && (
          <>
            <View
              className="ntr-btn ntr-btn--primary am-action"
              onClick={() => void publishSchedule()}
            >
              <Text>发布赛程</Text>
            </View>
            <View
              className="ntr-btn ntr-btn--ghost am-action"
              onClick={() =>
                void genSchedule('schedule/regenerate', '重新生成将覆盖当前赛程，确认继续？')
              }
            >
              <Text>重新生成</Text>
            </View>
          </>
        )}
        {hasRounds && published && (
          <>
            <View className="am-published">
              <Text className="ntr-tag ntr-tag--primary">已发布</Text>
            </View>
            <View
              className="ntr-btn ntr-btn--ghost am-action"
              onClick={() =>
                void genSchedule('schedule/regenerate', '重新生成将覆盖当前赛程，确认继续？')
              }
            >
              <Text>重新生成</Text>
            </View>
          </>
        )}
        {hasRounds && (
          <View className="ntr-text-3 am-overview">
            {roundCount} 轮 · {totalMatches} 场对局
          </View>
        )}
      </View>
    </View>
  );
}
