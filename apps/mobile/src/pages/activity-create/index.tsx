import { useCallback, useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Text, View } from '@tarojs/components';

import {
  ACTIVITY_MODES,
  MATCH_RULES,
  getMatchRule,
  type ActivityDetailResponse,
  type ActivityMode,
  type CreateActivityRequest,
} from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { requireLogin } from '../../services/guard';
import KnockoutOptions from './components/knockout-options';
import SliderField from './components/slider-field';
import DateTimeField from './components/datetime-field';
import { buildAutoTitle, LEVEL_OPTIONS, useActivityForm } from './hooks/use-activity-form';

import './index.scss';

const MODE_OPTIONS: { value: ActivityMode; label: string; tip: string }[] = [
  { value: ACTIVITY_MODES.ROUND_ROBIN, label: '单打循环赛', tip: '灵活人数全场循环' },
  { value: ACTIVITY_MODES.GROUP_KNOCKOUT, label: '单打淘汰赛', tip: '标准4人制小组赛+ 淘汰赛' },
];

const GAMES_OPTIONS = [4, 5, 6] as const;
const GAMES_LABELS: Record<number, string> = { 4: '四局', 5: '五局', 6: '六局' };
const DEUCE_OPTIONS = [
  { value: true, label: '金球' },
  { value: false, label: '占先' },
] as const;

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function buildCourtNames(venue: string, count: number): string[] {
  const names = venue
    ? venue
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return Array.from({ length: count }, (_, i) => names[i] ?? `${i + 1}号场`);
}

function ruleGames(rule: ReturnType<typeof getMatchRule>): number {
  return rule.targetGames;
}

export default function ActivityCreatePage() {
  const editingId = Taro.getCurrentInstance().router?.params?.id;
  const isEdit = Boolean(editingId);
  const { form, setField, setLocation, replace, iso } = useActivityForm();
  const [courtNames, setCourtNames] = useState<string[]>(() =>
    buildCourtNames(form.venue, form.courtCount),
  );
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const activeMode = MODE_OPTIONS.find(
    (option) => option.value === form.mode,
  ) as (typeof MODE_OPTIONS)[number];
  const isKnockout = form.mode === ACTIVITY_MODES.GROUP_KNOCKOUT;
  const autoTitle = buildAutoTitle(form);
  const levelIndex = Math.max(0, LEVEL_OPTIONS.indexOf(form.level));
  const selectedRule = getMatchRule(form.matchRuleCode);
  const gamesIndex = Math.max(
    0,
    GAMES_OPTIONS.indexOf(ruleGames(selectedRule) as (typeof GAMES_OPTIONS)[number]),
  );
  const noAdIndex = selectedRule.noAd ? 0 : 1;
  const venue =
    courtNames
      .map((s) => s.trim())
      .filter(Boolean)
      .join('、') || undefined;

  function setRuleCode(targetGames: number, noAd: boolean) {
    const code = MATCH_RULES.find(
      (rule) => rule.targetGames === targetGames && rule.noAd === noAd,
    )?.code;
    if (code) setField('matchRuleCode', code);
  }

  const loadDetail = useCallback(async () => {
    if (!editingId) return;
    try {
      const data = await apiRequest<ActivityDetailResponse>({ path: `/activities/${editingId}` });
      const s = splitDateTime(data.startAt);
      const e = splitDateTime(data.endAt);
      replace({
        mode: data.mode,
        level: data.level ?? '',
        note: data.note ?? '',
        startDate: s.date,
        startTime: s.time,
        endDate: e.date,
        endTime: e.time,
        locationName: data.locationName,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        maxPlayers: data.maxPlayers,
        courtCount: data.courtCount,
        matchRuleCode: data.matchRuleCode,
        groupCount: data.groupCount ?? 2,
        qualifyPerGroup: data.qualifyPerGroup ?? 1,
        enableThirdPlace: data.enableThirdPlace ?? false,
      });
      setCourtNames(buildCourtNames(data.venue ?? '', data.courtCount));
    } catch {
      void Taro.showToast({ title: '加载赛事失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [editingId, replace]);

  useEffect(() => {
    if (isEdit) void Taro.setNavigationBarTitle({ title: '编辑赛事' });
    void loadDetail();
  }, [loadDetail, isEdit]);

  function toast(message: string) {
    void Taro.showToast({ title: message, icon: 'none' });
  }

  function chooseLocation() {
    void Taro.chooseLocation({
      success: (res) => {
        setLocation({
          name: res.name || form.locationName,
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: () => {
        toast('未获得定位权限，请手动填写地点');
      },
    });
  }

  function handleCourtCount(value: number) {
    setField('courtCount', value);
    setCourtNames((prev) => Array.from({ length: value }, (_, i) => prev[i] ?? `${i + 1}号场`));
  }

  function handleCourtName(index: number, value: string) {
    setCourtNames((prev) => prev.map((name, i) => (i === index ? value : name)));
  }

  function buildPayload(): CreateActivityRequest {
    return {
      mode: form.mode,
      title: autoTitle,
      level: form.level || undefined,
      note: form.note.trim() || undefined,
      startAt: iso(form.startDate, form.startTime),
      endAt: iso(form.endDate, form.endTime),
      locationName: form.locationName.trim(),
      ...(form.latitude != null ? { latitude: form.latitude } : {}),
      ...(form.longitude != null ? { longitude: form.longitude } : {}),
      venue,
      courtCount: form.courtCount,
      maxPlayers: form.maxPlayers,
      matchRuleCode: form.matchRuleCode,
      ...(isKnockout
        ? {
            groupCount: form.groupCount,
            qualifyPerGroup: form.qualifyPerGroup,
            enableThirdPlace: form.enableThirdPlace,
          }
        : {}),
    };
  }

  async function submit() {
    if (!requireLogin()) return;
    const start = Date.parse(iso(form.startDate, form.startTime));
    const end = Date.parse(iso(form.endDate, form.endTime));
    if (end <= start) {
      toast('结束时间必须晚于开始时间');
      return;
    }
    if (!form.locationName.trim()) {
      toast('请填写地点名称');
      return;
    }
    const modal = await Taro.showModal({
      title: isEdit ? '保存修改' : '发布赛事',
      content: isEdit
        ? '确认保存赛事修改？保存后自动更新。'
        : '确认发布该赛事？确认后选手即可报名。',
      confirmColor: '#1f9d66',
    });
    if (!modal.confirm) return;
    setSubmitting(true);
    try {
      if (isEdit && editingId) {
        await apiRequest<void>({
          path: `/activities/${editingId}`,
          method: 'PUT',
          data: buildPayload(),
        });
        void Taro.showToast({ title: '已保存', icon: 'success' });
      } else {
        await apiRequest<CreateActivityRequest>({
          path: '/activities',
          method: 'POST',
          data: buildPayload(),
        });
        void Taro.showToast({ title: '发布成功', icon: 'success' });
      }
      setTimeout(() => void Taro.navigateBack(), 1200);
    } catch (error) {
      toast((error as { message?: string }).message ?? (isEdit ? '保存失败' : '发布失败'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="ntr-page">
        <View className="ntr-empty">
          <View className="ntr-empty__icon">…</View>
          <Text className="ntr-empty__text">加载中</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="ntr-page activity-create">
      <View className="ntr-card activity-create__preview">
        <View className="activity-create__thumb">
          <Text className="activity-create__thumb-title">
            {autoTitle || '填写信息后自动生成标题'}
          </Text>
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">时间</Text>
        </View>
        <View className="activity-create__time-grid">
          <DateTimeField
            label="开始时间"
            date={form.startDate}
            time={form.startTime}
            onDateChange={(v) => setField('startDate', v)}
            onTimeChange={(v) => setField('startTime', v)}
          />
          <DateTimeField
            label="结束时间"
            date={form.endDate}
            time={form.endTime}
            onDateChange={(v) => setField('endDate', v)}
            onTimeChange={(v) => setField('endTime', v)}
          />
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">地点</Text>
        </View>
        <View className="ntr-field">
          <Input
            className="ntr-input"
            value={form.locationName}
            placeholder="地点名称"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('locationName', e.detail.value)}
          />
        </View>
        <View className="ntr-btn ntr-btn--ghost activity-create__map-btn" onClick={chooseLocation}>
          <Text>选择位置</Text>
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">赛制</Text>
        </View>
        <View className="ntr-seg">
          {MODE_OPTIONS.map((option) => (
            <View
              key={option.value}
              className={`ntr-seg__item ${form.mode === option.value ? 'ntr-seg__item--active' : ''}`}
              onClick={() => setField('mode', option.value)}
            >
              {option.label}
            </View>
          ))}
        </View>
        <Text className="activity-create__mode-tip">{activeMode.tip}</Text>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">赛制规则</Text>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">局数</Text>
          <View className="ntr-seg">
            {GAMES_OPTIONS.map((games, index) => (
              <View
                key={games}
                className={`ntr-seg__item ${gamesIndex === index ? 'ntr-seg__item--active' : ''}`}
                onClick={() => setRuleCode(games, selectedRule.noAd)}
              >
                {GAMES_LABELS[games]}
              </View>
            ))}
          </View>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">计分</Text>
          <View className="ntr-seg">
            {DEUCE_OPTIONS.map((deuce, index) => (
              <View
                key={String(deuce.value)}
                className={`ntr-seg__item ${noAdIndex === index ? 'ntr-seg__item--active' : ''}`}
                onClick={() => setRuleCode(ruleGames(selectedRule), deuce.value)}
              >
                {deuce.label}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">赛事等级</Text>
        </View>
        <SliderField
          label="等级"
          value={levelIndex}
          min={0}
          max={LEVEL_OPTIONS.length - 1}
          marks={LEVEL_OPTIONS}
          valueText={form.level || '未选择'}
          onChange={(v) => setField('level', LEVEL_OPTIONS[v] ?? '')}
        />
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">签位与场地</Text>
        </View>
        <SliderField
          label="人数"
          value={form.maxPlayers}
          min={2}
          max={32}
          valueText={`${form.maxPlayers}人`}
          onChange={(v) => setField('maxPlayers', v)}
        />
        <SliderField
          label="场地数量"
          value={form.courtCount}
          min={1}
          max={8}
          valueText={`${form.courtCount}片`}
          onChange={handleCourtCount}
        />
        <View className="ntr-field">
          <Text className="ntr-field__label">场地号</Text>
          <View className="activity-create__courts">
            {courtNames.map((name, index) => (
              <View key={index} className="activity-create__court">
                <Text className="activity-create__court-index">{index + 1}</Text>
                <Input
                  className="ntr-input activity-create__court-input"
                  value={name}
                  placeholder={`${index + 1}号场`}
                  placeholderClass="ntr-input__placeholder"
                  onInput={(e) => handleCourtName(index, e.detail.value)}
                />
              </View>
            ))}
          </View>
        </View>
      </View>

      {isKnockout && (
        <KnockoutOptions
          groupCount={form.groupCount}
          qualifyPerGroup={form.qualifyPerGroup}
          enableThirdPlace={form.enableThirdPlace}
          onGroupCount={(v) => setField('groupCount', v)}
          onQualifyPerGroup={(v) => setField('qualifyPerGroup', v)}
          onEnableThirdPlace={(v) => setField('enableThirdPlace', v)}
        />
      )}

      <View
        className={`ntr-btn ntr-btn--primary activity-create__submit ${
          submitting ? 'activity-create__submit--disabled' : ''
        }`}
        hoverClass="ntr-hover"
        onClick={() => void submit()}
      >
        <Text>{submitting ? '保存中…' : isEdit ? '保存修改' : '发布赛事'}</Text>
      </View>
    </View>
  );
}
