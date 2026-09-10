import { Picker, Text, View } from '@tarojs/components';
import { useMemo, useState } from 'react';

import './index.scss';

interface DateTimeFieldProps {
  label: string;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function splitDateTime(
  date: string,
  time: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const [y = new Date().getFullYear(), m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  return { year: y, month: m, day: d, hour: hh, minute: mm };
}

export default function DateTimeField({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: DateTimeFieldProps) {
  const current = splitDateTime(date, time);
  const years = useMemo(
    () => [current.year - 1, current.year, current.year + 1, current.year + 2],
    [current.year],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(
    () => Array.from({ length: daysInMonth(current.year, current.month) }, (_, i) => i + 1),
    [current.year, current.month],
  );
  const hours = useMemo(() => HOURS, []);
  const minutes = useMemo(() => MINUTES, []);
  const range = [years, months, days, hours, minutes];

  const [value, setValue] = useState(() => [
    Math.max(0, years.indexOf(current.year)),
    current.month - 1,
    current.day - 1,
    current.hour,
    current.minute,
  ]);
  const [pickedYear, setPickedYear] = useState(current.year);
  const [pickedMonth, setPickedMonth] = useState(current.month);

  function handleColumnChange(e: { detail: { column: number; value: number } }) {
    const { column, value: index } = e.detail;
    let nextYear = pickedYear;
    let nextMonth = pickedMonth;
    if (column === 0) nextYear = years[index];
    if (column === 1) nextMonth = months[index];
    setPickedYear(nextYear);
    setPickedMonth(nextMonth);
    setValue((prev) => {
      const next = [...prev];
      next[column] = index;
      const maxDay = daysInMonth(nextYear, nextMonth);
      if (next[2] > maxDay - 1) next[2] = maxDay - 1;
      return next;
    });
  }

  function handleChange(e: { detail: { value: number[] } }) {
    const [yi, mi, di, hi, mini] = e.detail.value;
    const year = years[yi];
    const month = months[mi];
    const day = Math.min(daysInMonth(year, month), di + 1);
    setPickedYear(year);
    setPickedMonth(month);
    setValue([yi, mi, di, hi, mini]);
    onDateChange(`${year}-${pad(month)}-${pad(day)}`);
    onTimeChange(`${pad(hours[hi])}:${pad(minutes[mini])}`);
  }

  return (
    <View className="datetime-field">
      <Text className="ntr-field__label">{label}</Text>
      <Picker
        mode="multiSelector"
        range={range}
        value={value}
        onColumnChange={handleColumnChange}
        onChange={handleChange}
      >
        <View className="datetime-field__value">
          {date || '选择日期'} {time || ''}
        </View>
      </Picker>
    </View>
  );
}
