import { Text, View } from '@tarojs/components';

interface StepperFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export default function StepperField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: StepperFieldProps) {
  const decrease = () => {
    if (value - step >= min) onChange(value - step);
  };
  const increase = () => {
    if (value + step <= max) onChange(value + step);
  };

  return (
    <View className="stepper-field">
      <Text className="ntr-field__label">{label}</Text>
      <View className="stepper-field__control">
        <View
          className={`stepper-field__btn ${value <= min ? 'stepper-field__btn--disabled' : ''}`}
          onClick={decrease}
        >
          <Text>−</Text>
        </View>
        <Text className="stepper-field__value">
          {value}
          {suffix ? <Text className="stepper-field__suffix">{suffix}</Text> : null}
        </Text>
        <View
          className={`stepper-field__btn ${value >= max ? 'stepper-field__btn--disabled' : ''}`}
          onClick={increase}
        >
          <Text>+</Text>
        </View>
      </View>
    </View>
  );
}
