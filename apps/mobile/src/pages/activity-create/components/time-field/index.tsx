import { Picker, Text, View } from '@tarojs/components';

interface TimeFieldProps {
  label: string;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

export default function TimeField({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: TimeFieldProps) {
  return (
    <View className="time-field">
      <Text className="ntr-field__label">{label}</Text>
      <View className="time-field__row">
        <Picker mode="date" value={date} onChange={(e) => onDateChange(e.detail.value)}>
          <View className="time-field__item">{date}</View>
        </Picker>
        <Picker mode="time" value={time} onChange={(e) => onTimeChange(e.detail.value)}>
          <View className="time-field__item">{time}</View>
        </Picker>
      </View>
    </View>
  );
}
