import { Text, View } from '@tarojs/components';

import {
  KNOCKOUT_STAGE_LABELS,
  type ActivityMatchResponse,
  type KnockoutBracketResponse,
} from '@ntr/shared';

import { stageLabel } from '../../../utils/format';

import './bracket-view.scss';

interface BracketViewProps {
  bracket: KnockoutBracketResponse | null;
  loading: boolean;
}

function MatchCell({ match }: { match: ActivityMatchResponse }) {
  const aScore = match.playerAGames != null ? match.playerAGames : '';
  const bScore = match.playerBGames != null ? match.playerBGames : '';
  const settled =
    match.recordStatus === 'COMPLETED' &&
    (match.confirmationState === 'CONFIRMED' || match.confirmationState === 'NOT_REQUIRED');
  const pending = match.recordStatus === 'PENDING';
  return (
    <View className="bk-cell">
      <View
        className={`bk-player ${aScore !== '' && match.winnerId === match.playerA?.signupId ? 'bk-player--win' : ''}`}
      >
        <Text className="bk-name">{match.playerA?.participantName ?? '待定'}</Text>
        <Text className="bk-score">{aScore}</Text>
      </View>
      <View
        className={`bk-player ${bScore !== '' && match.winnerId === match.playerB?.signupId ? 'bk-player--win' : ''}`}
      >
        <Text className="bk-name">{match.playerB?.participantName ?? '待定'}</Text>
        <Text className="bk-score">{bScore}</Text>
      </View>
      {pending && <View className="bk-pending" />}
      {settled && <View className="bk-done" />}
    </View>
  );
}

export default function BracketView({ bracket, loading }: BracketViewProps) {
  if (loading) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">…</View>
        <Text className="ntr-empty__text">加载对阵中</Text>
      </View>
    );
  }
  if (!bracket) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">⛨</View>
        <Text className="ntr-empty__text">暂无对阵，小组赛结束后自动生成</Text>
      </View>
    );
  }

  return (
    <View className="bk">
      <View className="bk-hero">
        <View className="bk-hero__champ">
          <Text className="bk-hero__label">冠军</Text>
          <Text className="bk-hero__name">{bracket.champion?.participantName ?? '—'}</Text>
        </View>
        {bracket.runnerUp && (
          <View className="bk-hero__runner">
            <Text className="bk-hero__label">亚军</Text>
            <Text className="bk-hero__name">{bracket.runnerUp.participantName}</Text>
          </View>
        )}
        {bracket.thirdPlace && (
          <View className="bk-hero__runner">
            <Text className="bk-hero__label">三四名</Text>
            <Text className="bk-hero__name">
              {bracket.thirdPlace.winnerId == null ? '待定' : '已赛'}
            </Text>
          </View>
        )}
      </View>

      {bracket.stages.map((stageGroup) => (
        <View key={stageGroup.stage} className="bk-stage">
          <Text className="bk-stage__title">{stageLabel(stageGroup.stage)}</Text>
          <View className="bk-stage__cells">
            {stageGroup.matches.map((match) => (
              <MatchCell key={match.id} match={match} />
            ))}
          </View>
        </View>
      ))}
      {bracket.thirdPlace && (
        <View className="bk-stage">
          <Text className="bk-stage__title">{KNOCKOUT_STAGE_LABELS.THIRD_PLACE}</Text>
          <View className="bk-stage__cells">
            <MatchCell match={bracket.thirdPlace} />
          </View>
        </View>
      )}
    </View>
  );
}
