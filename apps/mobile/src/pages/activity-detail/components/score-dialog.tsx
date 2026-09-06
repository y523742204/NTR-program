import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';
import { useState } from 'react';

import {
  getMatchRule,
  type ActivityMatchResponse,
  type MatchRuleCode,
  type MatchScoreConfirmationState,
  type MatchScoreRecordStatus,
} from '@ntr/shared';

import { apiRequest } from '../../../services/api';

import './score-dialog.scss';

interface ScoreDialogProps {
  activityId: string;
  match: ActivityMatchResponse;
  ruleCode: MatchRuleCode;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function statusText(
  recordStatus: MatchScoreRecordStatus,
  confirmation: MatchScoreConfirmationState,
): string {
  if (recordStatus === 'PENDING') return '待录入比分';
  if (recordStatus === 'UNPLAYED') return '本场未打';
  if (confirmation === 'PENDING_CONFIRM') return '等待对手确认';
  if (confirmation === 'DISPUTED') return '存在异议，待管理员裁决';
  if (confirmation === 'CONFIRMED') return '比分已确认';
  return '比分已定';
}

export default function ScoreDialog({
  activityId,
  match,
  ruleCode,
  isAdmin,
  onClose,
  onRefresh,
}: ScoreDialogProps) {
  const rule = getMatchRule(ruleCode);
  const [gamesA, setGamesA] = useState(match.playerAGames?.toString() ?? '');
  const [gamesB, setGamesB] = useState(match.playerBGames?.toString() ?? '');
  const [tbA, setTbA] = useState(match.playerATiebreakPoints?.toString() ?? '');
  const [tbB, setTbB] = useState(match.playerBTiebreakPoints?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  const playerA = match.playerA?.participantName ?? '待定';
  const playerB = match.playerB?.participantName ?? '待定';
  const gamesANum = Number(gamesA);
  const gamesBNum = Number(gamesB);
  const showTiebreak =
    rule.tiebreakAt !== null &&
    gamesA.trim() !== '' &&
    gamesBNum === gamesANum &&
    gamesANum === rule.tiebreakAt;

  const isSettled =
    match.recordStatus === 'COMPLETED' &&
    (match.confirmationState === 'CONFIRMED' || match.confirmationState === 'NOT_REQUIRED');
  const waitingConfirm =
    match.recordStatus === 'COMPLETED' && match.confirmationState === 'PENDING_CONFIRM';
  const iAmOpponent = Boolean(match.mySide) && match.mySide !== match.scoreSubmittedSide;
  const canEdit = match.recordStatus === 'PENDING';
  const editable = isAdmin || canEdit;

  function scorePayload() {
    return {
      playerAGames: gamesANum,
      playerBGames: gamesBNum,
      playerATiebreakPoints: showTiebreak ? Number(tbA) : undefined,
      playerBTiebreakPoints: showTiebreak ? Number(tbB) : undefined,
    };
  }

  async function run(action: string, method: 'PATCH' | 'POST', data?: unknown) {
    setSubmitting(true);
    try {
      await apiRequest({
        path: `/activities/${activityId}/matches/${match.id}${action}`,
        method,
        data,
      });
      return true;
    } catch (error) {
      void Taro.showToast({
        title: (error as { message?: string }).message ?? '操作失败',
        icon: 'none',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitScore(endpoint: string, successText: string) {
    if (await run(endpoint, endpoint.endsWith('/score') ? 'PATCH' : 'POST', scorePayload())) {
      void Taro.showToast({ title: successText, icon: 'none' });
      onRefresh();
      onClose();
    }
  }

  async function confirm() {
    if (await run('/confirm', 'POST')) {
      void Taro.showToast({ title: '已确认比分', icon: 'success' });
      onRefresh();
      onClose();
    }
  }

  async function dispute() {
    const modal = (await Taro.showModal({
      title: '对比分提出异议',
      content: '请说明争议原因',
      confirmColor: '#FF5C5B',
      editable: true,
    } as never)) as { confirm: boolean; content?: string };
    if (!modal.confirm || !modal.content?.trim()) return;
    if (await run('/dispute', 'POST', { reason: modal.content.trim() })) {
      void Taro.showToast({ title: '已提交异议', icon: 'none' });
      onRefresh();
      onClose();
    }
  }

  async function markUnplayed() {
    const modal = await Taro.showModal({
      title: '标记本场未打',
      content: '确认后该对局不计入排名',
      confirmColor: '#FF5C5B',
    });
    if (!modal.confirm) return;
    if (await run('/unplayed', 'POST', {})) {
      void Taro.showToast({ title: '已标记未打', icon: 'none' });
      onRefresh();
      onClose();
    }
  }

  return (
    <View className="score-dialog__mask" onClick={onClose}>
      <View className="score-dialog" onClick={(event) => event.stopPropagation()}>
        <View className="score-dialog__head">
          <Text className="score-dialog__title">录入比分</Text>
          <Text className="score-dialog__rule">{rule.label}</Text>
        </View>

        <View className="score-dialog__matchup">
          <View className="score-dialog__player">
            <Text className="score-dialog__name">{playerA}</Text>
          </View>
          <Text className="score-dialog__vs">VS</Text>
          <View className="score-dialog__player">
            <Text className="score-dialog__name">{playerB}</Text>
          </View>
        </View>

        <View className="score-dialog__status">
          <Text
            className={`ntr-tag ${
              match.recordStatus === 'UNPLAYED' || match.confirmationState === 'DISPUTED'
                ? 'ntr-tag--danger'
                : 'ntr-tag--muted'
            }`}
          >
            {statusText(match.recordStatus, match.confirmationState)}
          </Text>
        </View>

        <View className="score-dialog__inputs">
          <View className="score-dialog__input-box">
            <Text className="score-dialog__input-label">{playerA}</Text>
            <Input
              className="ntr-input score-dialog__game"
              type="number"
              value={gamesA}
              disabled={!editable}
              onInput={(event) => setGamesA(event.detail.value)}
              placeholder="局数"
            />
          </View>
          <Text className="score-dialog__colon">:</Text>
          <View className="score-dialog__input-box">
            <Text className="score-dialog__input-label">{playerB}</Text>
            <Input
              className="ntr-input score-dialog__game"
              type="number"
              value={gamesB}
              disabled={!editable}
              onInput={(event) => setGamesB(event.detail.value)}
              placeholder="局数"
            />
          </View>
        </View>

        {showTiebreak && (
          <View className="score-dialog__inputs score-dialog__inputs--tb">
            <Input
              className="ntr-input score-dialog__game"
              type="number"
              value={tbA}
              disabled={!editable}
              onInput={(event) => setTbA(event.detail.value)}
              placeholder="抢七 A 方"
            />
            <Text className="score-dialog__colon">:</Text>
            <Input
              className="ntr-input score-dialog__game"
              type="number"
              value={tbB}
              disabled={!editable}
              onInput={(event) => setTbB(event.detail.value)}
              placeholder="抢七 B 方"
            />
          </View>
        )}

        <View className="score-dialog__actions">
          {editable && !isSettled && (
            <View
              className="ntr-btn ntr-btn--primary"
              onClick={() => void submitScore('/score', '已提交，等待对手确认')}
            >
              <Text>{submitting ? '提交中…' : '提交比分'}</Text>
            </View>
          )}
          {waitingConfirm && iAmOpponent && (
            <>
              <View className="ntr-btn ntr-btn--primary" onClick={() => void confirm()}>
                <Text>确认比分</Text>
              </View>
              <View className="ntr-btn ntr-btn--danger" onClick={() => void dispute()}>
                <Text>有异议</Text>
              </View>
            </>
          )}
          {isAdmin && (
            <>
              <View
                className="ntr-btn ntr-btn--ghost"
                onClick={() => void submitScore('/arbitrate', '仲裁完成')}
              >
                <Text>{submitting ? '提交中…' : '仲裁确认'}</Text>
              </View>
              <View className="ntr-btn ntr-btn--danger" onClick={() => void markUnplayed()}>
                <Text>标记未打</Text>
              </View>
            </>
          )}
          {!editable && !waitingConfirm && !isAdmin && !isSettled && (
            <View className="score-dialog__readonly">
              <Text className="ntr-text-3">等待对方或管理员操作</Text>
            </View>
          )}
        </View>

        <View className="ntr-btn ntr-btn--ghost score-dialog__close" onClick={onClose}>
          <Text>关闭</Text>
        </View>
      </View>
    </View>
  );
}
