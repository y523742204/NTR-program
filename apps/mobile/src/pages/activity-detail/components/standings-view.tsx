import { Text, View } from '@tarojs/components';

import type {
  GroupStandingsResponse,
  RoundRobinStandingsResponse,
  StandingRowResponse,
} from '@ntr/shared';

import './standings-view.scss';

interface StandingsViewProps {
  mode: 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';
  data: RoundRobinStandingsResponse | GroupStandingsResponse | null;
  loading: boolean;
}

function RowLine({ row }: { row: StandingRowResponse }) {
  return (
    <View className="st-row">
      <View className={`st-row__rank ${row.rank <= 2 ? 'st-row__rank--top' : ''}`}>{row.rank}</View>
      <View className="st-row__name">
        <Text className="st-row__name-text">{row.participantName}</Text>
        {row.isMe && <Text className="ntr-tag ntr-tag--primary st-row__me">我</Text>}
      </View>
      <View className="st-col">{row.wins}</View>
      <View className="st-col">{row.losses}</View>
      <View className="st-col">{row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}</View>
      {row.qualified && (
        <View className="st-col">
          <Text className="ntr-tag ntr-tag--accent">出线</Text>
        </View>
      )}
    </View>
  );
}

export default function StandingsView({ mode, data, loading }: StandingsViewProps) {
  if (loading) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">…</View>
        <Text className="ntr-empty__text">加载排名中</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View className="ntr-empty">
        <View className="ntr-empty__icon">▤</View>
        <Text className="ntr-empty__text">暂无排名数据</Text>
      </View>
    );
  }

  if (mode === 'ROUND_ROBIN') {
    const rr = data as RoundRobinStandingsResponse;
    return (
      <View className="st">
        <View className="st-head">
          <Text className="st-head__rank">名次</Text>
          <Text className="st-head__name">选手</Text>
          <Text className="st-col">胜</Text>
          <Text className="st-col">负</Text>
          <Text className="st-col">净胜</Text>
        </View>
        {rr.rows.map((row) => (
          <RowLine key={row.signupId} row={row} />
        ))}
        {!rr.completed && <Text className="st-tip">排名随比分录入实时更新</Text>}
      </View>
    );
  }

  const group = data as GroupStandingsResponse;
  return (
    <View className="st">
      {group.groups.map((item) => (
        <View key={item.groupNumber} className="st-group">
          <Text className="st-group__title">小组 {item.groupNumber}</Text>
          <View className="st-head">
            <Text className="st-head__rank">名次</Text>
            <Text className="st-head__name">选手</Text>
            <Text className="st-col">胜</Text>
            <Text className="st-col">负</Text>
            <Text className="st-col">净胜</Text>
          </View>
          {item.rows.map((row) => (
            <RowLine key={row.signupId} row={row} />
          ))}
        </View>
      ))}
    </View>
  );
}
