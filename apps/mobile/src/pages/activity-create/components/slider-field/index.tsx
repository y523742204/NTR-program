import { Slider, Text, View } from '@tarojs/components';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  marks?: string[];
  valueText?: string;
  onChange: (value: number) => void;
}

export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  marks,
  valueText,
  onChange,
}: SliderFieldProps) {
  return (
    <View className="slider-field">
      <View className="slider-field__head">
        <Text className="ntr-field__label">{label}</Text>
        <Text className="slider-field__value">{valueText ?? value}</Text>
      </View>
      <Slider
        className="slider-field__slider"
        min={min}
        max={max}
        step={step}
        value={value}
        activeColor="#1f9d66"
        backgroundColor="#e4e7ea"
        blockSize={28}
        onChange={(e) => onChange(Number(e.detail.value))}
      />
      {marks && (
        <View className="slider-field__marks">
          {marks.map((mark) => (
            <Text key={mark} className="slider-field__mark">
              {mark}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
