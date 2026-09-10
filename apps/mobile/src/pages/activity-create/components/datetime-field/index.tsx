import { Picker, Text, View } from '@tarojs/components';

import './index.scss';

interface DateTimeFieldProps {
  label: string;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export default function DateTimeField({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: DateTimeFieldProps) {
  return (
    <View className="datetime-field">
      <Text className="ntr-field__label">{label}</Text>
      <View className="datetime-field__row">
        <Picker
          className="datetime-field__picker"
          mode="date"
          value={date}
          onChange={(e) => onDateChange(String(e.detail.value))}
        >
          <View className="datetime-field__value">{date || '选择日期'}</View>
        </Picker>
        <Picker
          className="datetime-field__picker"
          mode="time"
          value={time}
          onChange={(e) => onTimeChange(String(e.detail.value))}
        >
          <View className="datetime-field__value">{time || '选择时间'}</View>
        </Picker>
      </View>
    </View>
  );
}
