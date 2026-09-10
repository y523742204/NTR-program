import { Slider, Text, View } from '@tarojs/components';

import './index.scss';

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

const BLOCK_SIZE = 28;

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
  const span = max - min || 1;
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
        blockSize={BLOCK_SIZE}
        onChange={(e) => onChange(Number(e.detail.value))}
      />
      {marks && (
        <View className="slider-field__marks">
          {marks.map((mark, index) => (
            <Text
              key={mark}
              className="slider-field__mark"
              style={{ left: `${(index * step * 100) / span}%` }}
            >
              {mark}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
