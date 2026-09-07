import { useCallback, useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Picker, Text, View } from '@tarojs/components';

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
import StepperField from './components/stepper-field';
import TimeField from './components/time-field';
import { buildAutoTitle, LEVEL_OPTIONS, useActivityForm } from './hooks/use-activity-form';

import './index.scss';

const MODE_OPTIONS: { value: ActivityMode; label: string; tip: string }[] = [
  { value: ACTIVITY_MODES.ROUND_ROBIN, label: '单打循环赛', tip: '灵活人数全场互赛' },
  { value: ACTIVITY_MODES.GROUP_KNOCKOUT, label: '单打淘汰赛', tip: '标准 4~32 人（8人=2组×4）' },
];

const MATCH_RULE_LABELS = MATCH_RULES.map((rule) => rule.label);

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function ActivityCreatePage() {
  const editingId = Taro.getCurrentInstance().router?.params?.id;
  const isEdit = Boolean(editingId);
  const { form, setField, setLocation, replace, iso } = useActivityForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const activeMode = MODE_OPTIONS.find(
    (option) => option.value === form.mode,
  ) as (typeof MODE_OPTIONS)[number];
  const isKnockout = form.mode === ACTIVITY_MODES.GROUP_KNOCKOUT;
  const selectedRule = getMatchRule(form.matchRuleCode);
  const autoTitle = buildAutoTitle(form);

  const loadDetail = useCallback(async () => {
    if (!editingId) return;
    try {
      const data = await apiRequest<ActivityDetailResponse>({ path: `/activities/${editingId}` });
      const s = splitDateTime(data.startAt);
      const e = splitDateTime(data.endAt);
      const sg = splitDateTime(data.signupStartAt);
      replace({
        mode: data.mode,
        level: data.level ?? '',
        title: data.title,
        note: data.note ?? '',
        signupDate: sg.date,
        signupTime: sg.time,
        startDate: s.date,
        startTime: s.time,
        endDate: e.date,
        endTime: e.time,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        venue: data.venue ?? '',
        maxPlayers: data.maxPlayers,
        courtCount: data.courtCount,
        warmupMinutes: data.warmupMinutes,
        matchRuleCode: data.matchRuleCode,
        groupCount: data.groupCount ?? 2,
        qualifyPerGroup: data.qualifyPerGroup ?? 1,
        enableThirdPlace: data.enableThirdPlace ?? false,
      });
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
          address: res.address || '',
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: () => {
        toast('未获得定位权限，请手动填写地点');
      },
    });
  }

  function buildPayload(): CreateActivityRequest {
    return {
      mode: form.mode,
      title: form.title.trim() || autoTitle,
      level: form.level || undefined,
      note: form.note.trim() || undefined,
      signupStartAt: iso(form.signupDate, form.signupTime),
      startAt: iso(form.startDate, form.startTime),
      endAt: iso(form.endDate, form.endTime),
      locationName: form.locationName.trim(),
      locationAddress: form.locationAddress.trim(),
      ...(form.latitude != null ? { latitude: form.latitude } : {}),
      ...(form.longitude != null ? { longitude: form.longitude } : {}),
      venue: form.venue.trim() || undefined,
      courtCount: form.courtCount,
      maxPlayers: form.maxPlayers,
      warmupMinutes: form.warmupMinutes,
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
      confirmColor: '#2fbf7f',
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
            {form.level ? `【${form.level}】` : ''}
            {activeMode.label}
          </Text>
          <Text className="activity-create__thumb-sub">单打网球 · 以球会友</Text>
        </View>
        <View className="activity-create__title-box">
          <Text className="activity-create__title-label">自动生成标题</Text>
          <Text className="activity-create__title-text">{autoTitle || '填写信息后自动生成'}</Text>
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
        <View className="ntr-field">
          <Text className="ntr-field__label">赛事等级</Text>
          <Picker
            mode="selector"
            range={LEVEL_OPTIONS}
            value={Math.max(0, LEVEL_OPTIONS.indexOf(form.level))}
            onChange={(e) => setField('level', LEVEL_OPTIONS[Number(e.detail.value)])}
          >
            <View className="ntr-input activity-create__picker">{form.level || '选择等级'}</View>
          </Picker>
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">时间</Text>
        </View>
        <TimeField
          label="报名开始时间"
          date={form.signupDate}
          time={form.signupTime}
          onDateChange={(v) => setField('signupDate', v)}
          onTimeChange={(v) => setField('signupTime', v)}
        />
        <TimeField
          label="开始时间"
          date={form.startDate}
          time={form.startTime}
          onDateChange={(v) => setField('startDate', v)}
          onTimeChange={(v) => setField('startTime', v)}
        />
        <TimeField
          label="结束时间"
          date={form.endDate}
          time={form.endTime}
          onDateChange={(v) => setField('endDate', v)}
          onTimeChange={(v) => setField('endTime', v)}
        />
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">地点</Text>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">地点名称</Text>
          <Input
            className="ntr-input"
            value={form.locationName}
            placeholder="场馆名称"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('locationName', e.detail.value)}
          />
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">详细地址</Text>
          <Input
            className="ntr-input"
            value={form.locationAddress}
            placeholder="详细地址"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('locationAddress', e.detail.value)}
          />
        </View>
        <View className="ntr-btn ntr-btn--ghost activity-create__map-btn" onClick={chooseLocation}>
          <Text>选择地图</Text>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">场地</Text>
          <Input
            className="ntr-input"
            value={form.venue}
            placeholder="如：1号场、2号场"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('venue', e.detail.value)}
          />
        </View>
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">签位与场地</Text>
        </View>
        <StepperField
          label="签位人数"
          value={form.maxPlayers}
          min={2}
          max={32}
          suffix="人"
          onChange={(v) => setField('maxPlayers', v)}
        />
        <StepperField
          label="场地数量"
          value={form.courtCount}
          min={1}
          max={8}
          suffix="片"
          onChange={(v) => setField('courtCount', v)}
        />
        <StepperField
          label="热身分钟"
          value={form.warmupMinutes}
          min={0}
          max={60}
          suffix="分钟"
          onChange={(v) => setField('warmupMinutes', v)}
        />
      </View>

      <View className="ntr-card ntr-card--padded ntr-section">
        <View className="ntr-section-title">
          <Text className="ntr-section-title__text">赛制规则</Text>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">比分规则</Text>
          <Picker
            mode="selector"
            range={MATCH_RULE_LABELS}
            value={MATCH_RULES.findIndex((rule) => rule.code === form.matchRuleCode)}
            onChange={(e) => setField('matchRuleCode', MATCH_RULES[Number(e.detail.value)].code)}
          >
            <View className="ntr-input activity-create__picker">{selectedRule.label}</View>
          </Picker>
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
