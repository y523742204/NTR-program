import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Input, Picker, Text, Textarea, View } from '@tarojs/components';

import {
  ACTIVITY_MODES,
  MATCH_RULES,
  getMatchRule,
  type ActivityMode,
  type CreateActivityRequest,
} from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { requireLogin } from '../../services/guard';
import KnockoutOptions from './components/knockout-options';
import StepperField from './components/stepper-field';
import TimeField from './components/time-field';
import { useActivityForm } from './hooks/use-activity-form';

import './index.scss';

const MODE_OPTIONS: { value: ActivityMode; label: string; tip: string }[] = [
  { value: ACTIVITY_MODES.ROUND_ROBIN, label: '单循环', tip: '灵活人数全场互赛' },
  { value: ACTIVITY_MODES.GROUP_KNOCKOUT, label: '小组+淘汰', tip: '标准 4~32 人（8人=2组×4）' },
];

const MATCH_RULE_LABELS = MATCH_RULES.map((rule) => rule.label);

export default function ActivityCreatePage() {
  const { form, setField, setLocation, iso } = useActivityForm();
  const [submitting, setSubmitting] = useState(false);

  const activeMode = MODE_OPTIONS.find(
    (option) => option.value === form.mode,
  ) as (typeof MODE_OPTIONS)[number];
  const isKnockout = form.mode === ACTIVITY_MODES.GROUP_KNOCKOUT;
  const selectedRule = getMatchRule(form.matchRuleCode);

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
      title: form.title.trim() || undefined,
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
      title: '发布赛事',
      content: '确认发布该赛事？确认后选手即可报名。',
      confirmColor: '#35e69c',
    });
    if (!modal.confirm) return;
    setSubmitting(true);
    try {
      await apiRequest<CreateActivityRequest>({
        path: '/activities',
        method: 'POST',
        data: buildPayload(),
      });
      void Taro.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => void Taro.navigateBack(), 1200);
    } catch (error) {
      toast((error as { message?: string }).message ?? '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="ntr-page activity-create">
      <View className="ntr-card ntr-card--padded">
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
          <Text className="ntr-section-title__text">基本信息</Text>
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">标题</Text>
          <Input
            className="ntr-input"
            value={form.title}
            placeholder="留空自动生成"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('title', e.detail.value)}
          />
        </View>
        <View className="ntr-field">
          <Text className="ntr-field__label">备注</Text>
          <Textarea
            className="ntr-textarea"
            value={form.note}
            placeholder="赛事说明、规则补充等"
            placeholderClass="ntr-input__placeholder"
            onInput={(e) => setField('note', e.detail.value)}
          />
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
          <Text className="ntr-section-title__text">人数与场地</Text>
        </View>
        <StepperField
          label="参赛人数"
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
          <Text className="ntr-field__label">赛制</Text>
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
        onClick={() => void submit()}
      >
        <Text>{submitting ? '发布中…' : '发布赛事'}</Text>
      </View>
    </View>
  );
}
