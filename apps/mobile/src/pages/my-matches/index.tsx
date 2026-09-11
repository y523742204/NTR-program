import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { Clock, Location } from '@taroify/icons';
import { useCallback, useState } from 'react';

import type { UserMatchItemResponse, UserRecordsResponse } from '@ntr/shared';

import UserAvatar from '../../components/user-avatar';
import { apiRequest, resolveApiAssetUrl } from '../../services/api';
import { getAuthSession } from '../../services/auth-session';
import { requireLogin } from '../../services/guard';
import { stageLabel } from '../../utils/format';

import './index.scss';

const PAGE_SIZE = 10;

function statusTag(item: UserMatchItemResponse): { text: string; tone: string } | null {
  if (item.recordStatus === 'UNPLAYED') return { text: '未打', tone: 'ntr-tag--danger' };
  if (item.recordStatus === 'PENDING') return { text: '待录入', tone: 'ntr-tag--muted' };
  if (item.confirmationState === 'PENDING_CONFIRM')
    return { text: '待对方确认', tone: 'ntr-tag--warn' };
  if (item.confirmationState === 'DISPUTED') return { text: '有异议', tone: 'ntr-tag--danger' };
  return { text: '已定', tone: 'ntr-tag--primary' };
}

function stageText(item: UserMatchItemResponse): string | null {
  if (item.stage) return stageLabel(item.stage);
  if (item.roundNumber != null) return `第${item.roundNumber}轮`;
  return null;
}

function MatchCard({ match, isSelf }: { match: UserMatchItemResponse; isSelf: boolean }) {
  const stage = stageText(match);
  const status = statusTag(match);
  const played = match.subjectGames != null && match.opponentGames != null;
  const won = match.subjectIsWinner === true;
  const lost = match.subjectIsWinner === false;
  const subjectClass = won
    ? 'rec-card__name--win'
    : lost
      ? 'rec-card__name--loss'
      : 'rec-card__name--me';
  const scoreClass = played
    ? won
      ? 'rec-card__score--win'
      : lost
        ? 'rec-card__score--loss'
        : ''
    : 'rec-card__score--vs';
  return (
    <View className="ntr-card rec-card">
      <View className="rec-card__head">
        <Text className="rec-card__title">{match.activityTitle}</Text>
        {stage && <Text className="ntr-tag ntr-tag--primary">{stage}</Text>}
      </View>
      <View className="rec-card__body">
        <View className="rec-card__side">
          <UserAvatar
            userId={match.subjectUserId}
            name={match.subjectParticipantName}
            avatarUrl={match.subjectAvatarUrl}
            className="rec-card__avatar"
          />
          <View className="rec-card__player">
            <Text className={`rec-card__name ${subjectClass}`}>{match.subjectParticipantName}</Text>
            {isSelf && <Text className="rec-card__me-tag">我</Text>}
          </View>
        </View>
        <Text className={`rec-card__score ${scoreClass}`}>
          {played ? `${match.subjectGames}:${match.opponentGames}` : 'VS'}
        </Text>
        <View className="rec-card__side rec-card__side--right">
          <View className="rec-card__player rec-card__player--right">
            <Text className="rec-card__name">{match.opponentName}</Text>
            <Text className="rec-card__me-tag">对手</Text>
          </View>
          <UserAvatar
            userId={match.opponentUserId}
            name={match.opponentName}
            avatarUrl={match.opponentAvatarUrl}
            className="rec-card__avatar"
          />
        </View>
      </View>
      <View className="rec-card__foot">
        <View className="rec-card__meta">
          {match.courtName && (
            <View className="rec-card__meta-item">
              <Location className="rec-card__meta-icon" size="20" />
              <Text>{match.courtName}</Text>
            </View>
          )}
          {match.startAt && (
            <View className="rec-card__meta-item">
              <Clock className="rec-card__meta-icon" size="20" />
              <Text>{match.startAt.slice(5, 16).replace('T', ' ')}</Text>
            </View>
          )}
        </View>
        {status && <Text className={`ntr-tag ${status.tone}`}>{status.text}</Text>}
      </View>
    </View>
  );
}

export default function UserRecordsPage() {
  const routeUserId = Taro.getCurrentInstance().router?.params?.userId;
  const targetUserId = routeUserId ? String(routeUserId) : undefined;
  const sessionUserId = getAuthSession()?.user.id ?? null;
  const userId = targetUserId ?? sessionUserId;
  const isSelf = !targetUserId || targetUserId === sessionUserId;

  const [data, setData] = useState<UserRecordsResponse | null>(null);
  const [items, setItems] = useState<UserMatchItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await apiRequest<UserRecordsResponse>({
          path: `/activities/users/${userId}/records?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        });
        setData(res);
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(targetPage);
        if (!isSelf) void Taro.setNavigationBarTitle({ title: `${res.profile.name}的战绩` });
      } catch (err) {
        setError((err as { message?: string }).message ?? '加载失败');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [userId, isSelf],
  );

  useDidShow(() => {
    if (!userId) {
      requireLogin();
      return;
    }
    if (isSelf) void Taro.setNavigationBarTitle({ title: '我的战绩' });
    void fetchPage(1, false);
  });

  useReachBottom(() => {
    if (!loading && items.length < total) void fetchPage(page + 1, true);
  });

  if (initialLoading) {
    return (
      <View className="ntr-page">
        <View className="ntr-empty">
          <View className="ntr-empty__icon">…</View>
          <Text className="ntr-empty__text">加载中</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="ntr-page">
        <View className="ntr-empty">
          <View className="ntr-empty__icon">⚠</View>
          <Text className="ntr-empty__text">{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="ntr-page">
      {data && (
        <View className="ntr-card records-head">
          <View className="ntr-avatar records-head__avatar">
            {data.profile.avatarUrl ? (
              <Image src={resolveApiAssetUrl(data.profile.avatarUrl)} mode="aspectFill" />
            ) : (
              <Text>{data.profile.name.slice(0, 1)}</Text>
            )}
          </View>
          <View className="records-head__info">
            <View className="records-head__name-row">
              <Text className="records-head__name">{data.profile.name}</Text>
              {data.profile.level && (
                <Text className="ntr-tag ntr-tag--muted">{data.profile.level}</Text>
              )}
            </View>
            <Text className="records-head__meta">
              {isSelf ? '我的历史战绩' : '历史战绩'} · 已决 {data.summary.played} 场
            </Text>
          </View>
        </View>
      )}

      {data && (
        <View className="ntr-card matches-summary">
          <View className="matches-summary__item">
            <Text className="matches-summary__num matches-summary__num--win">
              {data.summary.wins}
            </Text>
            <Text className="matches-summary__label">胜</Text>
          </View>
          <View className="matches-summary__item">
            <Text className="matches-summary__num matches-summary__num--loss">
              {data.summary.losses}
            </Text>
            <Text className="matches-summary__label">负</Text>
          </View>
          <View className="matches-summary__item">
            <Text className="matches-summary__num">{data.summary.winRate}%</Text>
            <Text className="matches-summary__label">胜率</Text>
          </View>
        </View>
      )}

      <View className="matches-list">
        {items.length === 0 && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">▢</View>
            <Text className="ntr-empty__text">还没有比赛记录</Text>
          </View>
        )}
        {items.map((match) => (
          <MatchCard key={match.matchId} match={match} isSelf={isSelf} />
        ))}
        {items.length > 0 && (
          <View className="matches-list__foot">
            <Text className="ntr-text-3">
              {items.length >= total && total > 0 ? '没有更多了' : '上拉加载更多…'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
