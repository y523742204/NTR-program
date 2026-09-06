import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useState } from 'react';

import type { MyMatchItemResponse, MyMatchListResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { requireLogin } from '../../services/guard';
import { stageLabel } from '../../utils/format';

import './index.scss';

const PAGE_SIZE = 10;

function statusTag(item: MyMatchItemResponse): { text: string; tone: string } | null {
  if (item.recordStatus === 'UNPLAYED') return { text: '未打', tone: 'ntr-tag--danger' };
  if (item.recordStatus === 'PENDING') return { text: '待录入', tone: 'ntr-tag--muted' };
  if (item.confirmationState === 'PENDING_CONFIRM')
    return { text: '待对方确认', tone: 'ntr-tag--warn' };
  if (item.confirmationState === 'DISPUTED') return { text: '有异议', tone: 'ntr-tag--danger' };
  return { text: '已定', tone: 'ntr-tag--primary' };
}

function stageText(item: MyMatchItemResponse): string | null {
  if (item.stage) return stageLabel(item.stage);
  if (item.roundNumber != null) return `第${item.roundNumber}轮`;
  return null;
}

function MatchCard({ match }: { match: MyMatchItemResponse }) {
  const stage = stageText(match);
  const status = statusTag(match);
  const played = match.myGames != null && match.opponentGames != null;
  const won = match.isWinner === true;
  const lost = match.isWinner === false;
  const meClass = won
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
          <View className="ntr-avatar rec-card__avatar">
            <Text>{match.myParticipantName.slice(0, 1)}</Text>
          </View>
          <View className="rec-card__player">
            <Text className={`rec-card__name ${meClass}`}>{match.myParticipantName}</Text>
            <Text className="rec-card__me-tag">我</Text>
          </View>
        </View>
        <Text className={`rec-card__score ${scoreClass}`}>
          {played ? `${match.myGames}:${match.opponentGames}` : 'VS'}
        </Text>
        <View className="rec-card__side rec-card__side--right">
          <View className="rec-card__player rec-card__player--right">
            <Text className="rec-card__name">{match.opponentName}</Text>
            <Text className="rec-card__me-tag">对手</Text>
          </View>
          <View className="ntr-avatar rec-card__avatar">
            <Text>{match.opponentName.slice(0, 1)}</Text>
          </View>
        </View>
      </View>
      <View className="rec-card__foot">
        <View className="rec-card__meta">
          {match.courtName && <Text className="rec-card__meta-item">◎ {match.courtName}</Text>}
          {match.startAt && (
            <Text className="rec-card__meta-item">◷ {match.startAt.slice(11, 16)}</Text>
          )}
        </View>
        {status && <Text className={`ntr-tag ${status.tone}`}>{status.text}</Text>}
      </View>
    </View>
  );
}

export default function MyMatchesPage() {
  const [items, setItems] = useState<MyMatchItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPage = useCallback(async (targetPage: number, append: boolean) => {
    setLoading(true);
    try {
      const data = await apiRequest<MyMatchListResponse>({
        path: `/activities/matches/me?page=${targetPage}&pageSize=${PAGE_SIZE}`,
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

  const wins = items.filter((item) => item.isWinner === true).length;
  const losses = items.filter((item) => item.isWinner === false).length;
  const hasRecord = !initialLoading && items.length > 0;

  return (
    <View className="ntr-page">
      {hasRecord && (
        <View className="ntr-card matches-summary">
          <View className="matches-summary__item">
            <Text className="matches-summary__num matches-summary__num--win">{wins}</Text>
            <Text className="matches-summary__label">胜</Text>
          </View>
          <View className="matches-summary__item">
            <Text className="matches-summary__num matches-summary__num--loss">{losses}</Text>
            <Text className="matches-summary__label">负</Text>
          </View>
          <View className="matches-summary__item">
            <Text className="matches-summary__num">{wins + losses}</Text>
            <Text className="matches-summary__label">已决</Text>
          </View>
        </View>
      )}

      <View className="matches-list">
        {initialLoading && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">…</View>
            <Text className="ntr-empty__text">加载中</Text>
          </View>
        )}
        {!initialLoading && items.length === 0 && (
          <View className="ntr-empty">
            <View className="ntr-empty__icon">▢</View>
            <Text className="ntr-empty__text">还打过比赛</Text>
          </View>
        )}
        {items.map((match) => (
          <MatchCard key={match.matchId} match={match} />
        ))}
        {!initialLoading && items.length > 0 && (
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
