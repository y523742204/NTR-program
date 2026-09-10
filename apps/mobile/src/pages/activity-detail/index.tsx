import Taro, { useDidShow } from '@tarojs/taro';
import { ScrollView, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useState } from 'react';

import {
  ACTIVITY_MODES,
  getMatchRule,
  type ActivityDetailResponse,
  type ActivityMatchResponse,
  type GroupStandingsResponse,
  type KnockoutBracketResponse,
  type RoundRobinStandingsResponse,
  type ScheduleResponse,
} from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { getAuthSession } from '../../services/auth-session';
import { requireLogin, requireProfile } from '../../services/guard';
import { formatRange, modeLabel } from '../../utils/format';

import ScoreDialog from './components/score-dialog';
import StandingsView from './components/standings-view';
import BracketView from './components/bracket-view';

import './index.scss';

type DetailTab = 'schedule' | 'standings' | 'bracket';

export default function ActivityDetailPage() {
  const activityId = Taro.getCurrentInstance().router?.params?.id as string;
  const [detail, setDetail] = useState<ActivityDetailResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>('schedule');
  const [roundFilter, setRoundFilter] = useState<number | null>(null);
  const [standings, setStandings] = useState<
    RoundRobinStandingsResponse | GroupStandingsResponse | null
  >(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [bracket, setBracket] = useState<KnockoutBracketResponse | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [dialogMatch, setDialogMatch] = useState<ActivityMatchResponse | null>(null);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    try {
      const data = await apiRequest<ActivityDetailResponse>({ path: `/activities/${activityId}` });
      setDetail(data);
      return data;
    } catch {
      setError('赛事不存在或已删除');
      return null;
    }
  }, [activityId]);

  const loadSchedule = useCallback(async () => {
    try {
      const data = await apiRequest<ScheduleResponse>({
        path: `/activities/${activityId}/schedule`,
      });
      setSchedule(data);
    } catch {
      setSchedule(null);
    } finally {
      setScheduleLoading(false);
    }
  }, [activityId]);

  const loadStandings = useCallback(async () => {
    setStandingsLoading(true);
    try {
      const data = await apiRequest<RoundRobinStandingsResponse | GroupStandingsResponse>({
        path: `/activities/${activityId}/standings`,
      });
      setStandings(data);
    } catch {
      setStandings(null);
    } finally {
      setStandingsLoading(false);
    }
  }, [activityId]);

  const loadBracket = useCallback(async () => {
    setBracketLoading(true);
    try {
      const data = await apiRequest<KnockoutBracketResponse>({
        path: `/activities/${activityId}/bracket`,
      });
      setBracket(data);
    } catch {
      setBracket(null);
    } finally {
      setBracketLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void loadDetail();
    void loadSchedule();
  }, [loadDetail, loadSchedule]);

  useEffect(() => {
    if (tab === 'standings' && !standings) void loadStandings();
    if (tab === 'bracket' && !bracket) void loadBracket();
  }, [tab, standings, bracket, loadStandings, loadBracket]);

  const refresh = useCallback(async () => {
    await Promise.all([loadSchedule()]);
    if (tab === 'standings') void loadStandings();
    if (tab === 'bracket') void loadBracket();
  }, [loadSchedule, loadStandings, loadBracket, tab]);

  useDidShow(() => {
    if (detail) void loadDetail();
  });

  const isAdmin = getAuthSession()?.user.role === 'ADMIN';
  const canManage = Boolean(detail?.canManage);

  async function join() {
    if (!requireLogin() || !requireProfile()) return;
    if (detail?.mySignup) {
      await apiRequest<void>({ path: `/activities/${activityId}/signups/me`, method: 'DELETE' });
    } else {
      await apiRequest({ path: `/activities/${activityId}/signups`, method: 'POST', data: {} });
    }
    await loadDetail();
    await loadSchedule();
  }

  async function removeSignup(signupId: string) {
    const modal = await Taro.showModal({
      title: '移除该报名',
      content: '确认将该选手移出本次赛事？',
      confirmColor: '#FF5C5B',
    });
    if (!modal.confirm) return;
    try {
      await apiRequest({ path: `/activities/${activityId}/signups/${signupId}`, method: 'DELETE' });
      await loadDetail();
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '操作失败',
        icon: 'none',
      });
    }
  }

  async function removeActivity() {
    const modal = await Taro.showModal({
      title: '删除赛事',
      content: '删除后赛事及其报名、赛程、比分将全部清除且不可恢复，确认删除？',
      confirmColor: '#FF5C5B',
    });
    if (!modal.confirm) return;
    try {
      await apiRequest<void>({ path: `/activities/${activityId}`, method: 'DELETE' });
      void Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => {
        if (Taro.getCurrentPages().length > 1) void Taro.navigateBack();
        else void Taro.reLaunch({ url: '/pages/index/index' });
      }, 800);
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '删除失败',
        icon: 'none',
      });
    }
  }

  if (error) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">⚠</View>
        <Text className="ntr-empty__text">{error}</Text>
      </View>
    );
  }
  if (!detail) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">…</View>
        <Text className="ntr-empty__text">加载中</Text>
      </View>
    );
  }

  const rule = getMatchRule(detail.matchRuleCode);
  const isKnockout = detail.mode === ACTIVITY_MODES.GROUP_KNOCKOUT;
  const roundNumbers = schedule?.rounds.map((r) => r.roundNumber) ?? [];
  const visibleRounds =
    schedule?.rounds.filter((r) => roundFilter == null || r.roundNumber === roundFilter) ?? [];
  const mySignup = detail.mySignup;
  const joined = mySignup?.status === 'CONFIRMED';
  const waitlisted = mySignup?.status === 'WAITLISTED';
  const full = detail.signupCount >= detail.maxPlayers && detail.maxPlayers > 0;

  const tabs: { value: DetailTab; label: string }[] = [
    { value: 'schedule', label: '赛程' },
    { value: 'standings', label: '排名' },
    ...(isKnockout ? [{ value: 'bracket' as const, label: '对阵' }] : []),
  ];

  return (
    <View className="ntr-page detail-page">
      <View className="ntr-card detail-hero">
        <View className="detail-hero__top">
          <Text className="ntr-tag ntr-tag--primary">{modeLabel(detail.mode)}</Text>
          <Text className="ntr-tag ntr-tag--muted">{rule.label}</Text>
          <Text className="detail-hero__count">
            {detail.signupCount}/{detail.maxPlayers} 人
          </Text>
          {canManage && (
            <View className="detail-hero__actions">
              <Text
                className="detail-hero__manage"
                onClick={() =>
                  void Taro.navigateTo({ url: `/pages/activity-create/index?id=${activityId}` })
                }
              >
                编辑
              </Text>
              <Text
                className="detail-hero__manage"
                onClick={() =>
                  void Taro.navigateTo({ url: `/pages/activity-manage/index?id=${activityId}` })
                }
              >
                管理 ›
              </Text>
              {isAdmin && (
                <Text
                  className="detail-hero__manage detail-hero__manage--danger"
                  onClick={() => void removeActivity()}
                >
                  删除
                </Text>
              )}
            </View>
          )}
        </View>
        <Text className="detail-hero__title">{detail.title}</Text>
        <View className="detail-hero__meta">
          <View className="detail-hero__meta-row">
            <Text className="detail-hero__meta-label">时间</Text>
            <Text className="detail-hero__meta-value">
              {formatRange(detail.startAt, detail.endAt)}
            </Text>
          </View>
          <View className="detail-hero__meta-row">
            <Text className="detail-hero__meta-label">地点</Text>
            <Text className="detail-hero__meta-value">{detail.locationName}</Text>
          </View>
          <View className="detail-hero__meta-row">
            <Text className="detail-hero__meta-label">场地</Text>
            <Text className="detail-hero__meta-value">
              {detail.venue || `${detail.courtCount} 片场地`}
            </Text>
          </View>
          {detail.note && <Text className="detail-hero__note">{detail.note}</Text>}
        </View>
      </View>

      <View className="ntr-card detail-roster">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">报名名单</Text>
          <Text className="ntr-section-title__extra">
            {detail.waitlistedCount > 0 ? `${detail.waitlistedCount} 人候补` : ''}
          </Text>
        </View>
        <View className="detail-roster__grid">
          {detail.signups.map((signup) => (
            <View key={signup.id} className="detail-roster__item">
              <View className="ntr-avatar detail-roster__avatar">
                <Text>{(signup.participantName || '?').slice(0, 1)}</Text>
              </View>
              <Text className="detail-roster__name">{signup.participantName}</Text>
              {signup.status === 'WAITLISTED' && (
                <Text className="ntr-tag ntr-tag--warn">候补</Text>
              )}
              {signup.status === 'CONFIRMED' && full && signup.isMe && (
                <Text className="ntr-tag ntr-tag--primary">我</Text>
              )}
              {canManage && signup.userId && (
                <Text
                  className="detail-roster__remove"
                  onClick={() => void removeSignup(signup.id)}
                >
                  ×
                </Text>
              )}
            </View>
          ))}
          {detail.signups.length === 0 && <Text className="ntr-text-3">暂无报名</Text>}
        </View>
      </View>

      <View className="ntr-seg detail-tabs">
        {tabs.map((item) => (
          <View
            key={item.value}
            className={`ntr-seg__item ${tab === item.value ? 'ntr-seg__item--active' : ''}`}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </View>
        ))}
      </View>

      {tab === 'schedule' && (
        <View className="detail-schedule">
          {roundNumbers.length > 0 && !isKnockout && (
            <ScrollView scrollX className="detail-rounds">
              <View
                className={`detail-rounds__pill ${roundFilter == null ? 'detail-rounds__pill--active' : ''}`}
                onClick={() => setRoundFilter(null)}
              >
                全部
              </View>
              {roundNumbers.map((num) => (
                <View
                  key={num}
                  className={`detail-rounds__pill ${roundFilter === num ? 'detail-rounds__pill--active' : ''}`}
                  onClick={() => setRoundFilter(num)}
                >
                  第{num}轮
                </View>
              ))}
            </ScrollView>
          )}

          {isKnockout && roundNumbers.length > 0 && (
            <Text className="detail-schedule__tip">小组赛 · 淘汰对阵见「对阵」标签</Text>
          )}

          {scheduleLoading && (
            <View className="ntr-empty">
              <Text className="ntr-empty__text">加载赛程中</Text>
            </View>
          )}
          {!scheduleLoading && !detail.schedulePublished && !canManage && (
            <View className="ntr-empty">
              <View className="ntr-empty__icon">⌛</View>
              <Text className="ntr-empty__text">赛程待公布</Text>
            </View>
          )}
          {!scheduleLoading && canManage && roundNumbers.length === 0 && (
            <View className="ntr-empty">
              <View className="ntr-empty__icon">⚑</View>
              <Text className="ntr-empty__text">尚未生成赛程，请进入「管理」生成</Text>
            </View>
          )}
          {!scheduleLoading && roundNumbers.length === 0 && (
            <View className="ntr-empty">
              <View className="ntr-empty__icon">⚑</View>
              <Text className="ntr-empty__text">暂未生成赛程</Text>
            </View>
          )}

          {!scheduleLoading &&
            visibleRounds.map((round) => (
              <View key={round.roundId} className="detail-round">
                <Text className="detail-round__title">第 {round.roundNumber} 轮</Text>
                {round.matches.map((match) => (
                  <View
                    key={match.id}
                    className="detail-match"
                    onClick={() => setDialogMatch(match)}
                  >
                    <View className="detail-match__meta">
                      <Text className="detail-match__court">{match.courtName}</Text>
                      {match.groupNumber != null && (
                        <Text className="ntr-tag ntr-tag--muted">小组{match.groupNumber}</Text>
                      )}
                      <Text className="detail-match__time">
                        {match.startAt ? match.startAt.slice(11, 16) : ''}
                      </Text>
                    </View>
                    <View className="detail-match__body">
                      <View className="detail-match__side">
                        <Text
                          className={`detail-match__name ${match.winnerId && match.winnerId === match.playerA?.signupId ? 'detail-match__name--win' : ''}`}
                        >
                          {match.playerA?.participantName ?? '待定'}
                        </Text>
                        {match.mySide === 'A' && (
                          <Text className="ntr-tag ntr-tag--primary">我</Text>
                        )}
                      </View>
                      <Text className="detail-match__score">
                        {match.recordStatus === 'COMPLETED' && match.playerAGames != null
                          ? `${match.playerAGames}:${match.playerBGames}`
                          : 'VS'}
                        {match.recordStatus === 'COMPLETED' &&
                          match.playerATiebreakPoints != null &&
                          ` (${match.playerATiebreakPoints}:${match.playerBTiebreakPoints})`}
                      </Text>
                      <View className="detail-match__side detail-match__side--right">
                        <Text
                          className={`detail-match__name ${match.winnerId && match.winnerId === match.playerB?.signupId ? 'detail-match__name--win' : ''}`}
                        >
                          {match.playerB?.participantName ?? '待定'}
                        </Text>
                        {match.mySide === 'B' && (
                          <Text className="ntr-tag ntr-tag--primary">我</Text>
                        )}
                      </View>
                    </View>
                    <View className="detail-match__status">
                      {match.recordStatus === 'PENDING' && (
                        <Text className="ntr-tag ntr-tag--muted">待录入</Text>
                      )}
                      {match.recordStatus === 'UNPLAYED' && (
                        <Text className="ntr-tag ntr-tag--danger">未打</Text>
                      )}
                      {match.confirmationState === 'PENDING_CONFIRM' && (
                        <Text className="ntr-tag ntr-tag--warn">待确认</Text>
                      )}
                      {match.confirmationState === 'DISPUTED' && (
                        <Text className="ntr-tag ntr-tag--danger">异议</Text>
                      )}
                      {(match.confirmationState === 'CONFIRMED' ||
                        match.confirmationState === 'NOT_REQUIRED') &&
                        match.recordStatus === 'COMPLETED' && (
                          <Text className="ntr-tag ntr-tag--primary">已定</Text>
                        )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
        </View>
      )}

      {tab === 'standings' && (
        <StandingsView mode={detail.mode} data={standings} loading={standingsLoading} />
      )}

      {tab === 'bracket' && isKnockout && (
        <BracketView bracket={bracket} loading={bracketLoading} />
      )}

      <View className="detail-bar">
        {!mySignup && (
          <View className="ntr-btn ntr-btn--primary detail-bar__main" onClick={() => void join()}>
            <Text>{full ? '加入候补' : '立即报名'}</Text>
          </View>
        )}
        {waitlisted && (
          <View className="ntr-btn ntr-btn--ghost detail-bar__main" onClick={() => void join()}>
            <Text>候补中 · 点击取消</Text>
          </View>
        )}
        {joined && (
          <View className="ntr-btn ntr-btn--danger detail-bar__main" onClick={() => void join()}>
            <Text>取消报名</Text>
          </View>
        )}
      </View>

      {dialogMatch && (
        <ScoreDialog
          activityId={activityId}
          match={dialogMatch}
          ruleCode={detail.matchRuleCode}
          isAdmin={isAdmin}
          onClose={() => setDialogMatch(null)}
          onRefresh={() => void refresh()}
        />
      )}
    </View>
  );
}
