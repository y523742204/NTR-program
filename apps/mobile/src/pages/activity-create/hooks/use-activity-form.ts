import { useState } from 'react';

import { ACTIVITY_MODES, MATCH_RULES, type ActivityMode, type MatchRuleCode } from '@ntr/shared';

export interface ActivityForm {
  mode: ActivityMode;
  level: string;
  title: string;
  note: string;
  signupDate: string;
  signupTime: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  latitude?: number;
  longitude?: number;
  venue: string;
  maxPlayers: number;
  courtCount: number;
  warmupMinutes: number;
  matchRuleCode: MatchRuleCode;
  groupCount: number;
  qualifyPerGroup: number;
  enableThirdPlace: boolean;
}

export interface LocationPick {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export const LEVEL_OPTIONS = ['2.5', '3.0', '3.5', '4.0', '4.5'];

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initForm(): ActivityForm {
  const today = todayDate();
  return {
    mode: ACTIVITY_MODES.ROUND_ROBIN,
    level: '3.0',
    title: '',
    note: '',
    signupDate: today,
    signupTime: '08:00',
    startDate: today,
    startTime: '09:00',
    endDate: today,
    endTime: '12:00',
    locationName: '',
    locationAddress: '',
    venue: '',
    maxPlayers: 8,
    courtCount: 2,
    warmupMinutes: 10,
    matchRuleCode: MATCH_RULES[0].code,
    groupCount: 2,
    qualifyPerGroup: 1,
    enableThirdPlace: false,
  };
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return WEEKDAYS[d.getDay()] ?? '';
}

export function buildAutoTitle(
  form: Pick<ActivityForm, 'level' | 'mode' | 'locationName' | 'startDate' | 'startTime'>,
): string {
  const level = form.level ? `【${form.level}】` : '';
  const mode = form.mode === ACTIVITY_MODES.ROUND_ROBIN ? '单打循环赛' : '单打淘汰赛';
  const location = form.locationName.trim();
  const time = form.startTime ? `-${weekdayOf(form.startDate)}${form.startTime}` : '';
  const place = location ? ` (${location}${time})` : time ? ` (${time})` : '';
  return `${level}${mode}${place}`;
}

export function useActivityForm(initial?: Partial<ActivityForm>) {
  const [form, setForm] = useState<ActivityForm>({ ...initForm(), ...initial });

  function setField<K extends keyof ActivityForm>(key: K, value: ActivityForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLocation(location: LocationPick) {
    setForm((prev) => ({ ...prev, ...location }));
  }

  function replace(patch: Partial<ActivityForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function iso(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  return { form, setField, setLocation, replace, iso };
}
