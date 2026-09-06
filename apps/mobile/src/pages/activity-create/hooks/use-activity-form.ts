import { useState } from 'react';

import { ACTIVITY_MODES, MATCH_RULES, type ActivityMode, type MatchRuleCode } from '@ntr/shared';

export interface ActivityForm {
  mode: ActivityMode;
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

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initForm(): ActivityForm {
  const today = todayDate();
  return {
    mode: ACTIVITY_MODES.ROUND_ROBIN,
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

export function useActivityForm() {
  const [form, setForm] = useState<ActivityForm>(initForm);

  function setField<K extends keyof ActivityForm>(key: K, value: ActivityForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLocation(location: LocationPick) {
    setForm((prev) => ({ ...prev, ...location }));
  }

  function iso(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  return { form, setField, setLocation, iso };
}
