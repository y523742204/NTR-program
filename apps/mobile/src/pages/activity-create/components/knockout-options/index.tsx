import { Switch, Text, View } from '@tarojs/components';

import StepperField from '../stepper-field';

interface KnockoutOptionsProps {
  groupCount: number;
  qualifyPerGroup: number;
  enableThirdPlace: boolean;
  onGroupCount: (value: number) => void;
  onQualifyPerGroup: (value: number) => void;
  onEnableThirdPlace: (value: boolean) => void;
}

export default function KnockoutOptions({
  groupCount,
  qualifyPerGroup,
  enableThirdPlace,
  onGroupCount,
  onQualifyPerGroup,
  onEnableThirdPlace,
}: KnockoutOptionsProps) {
  return (
    <View className="ntr-card ntr-card--padded ntr-section">
      <View className="ntr-section-title">
        <Text className="ntr-section-title__text">淘汰赛设置</Text>
      </View>
      <StepperField
        label="分组数"
        value={groupCount}
        min={2}
        max={4}
        step={2}
        onChange={onGroupCount}
      />
      <StepperField
        label="每组出线数"
        value={qualifyPerGroup}
        min={1}
        max={2}
        onChange={onQualifyPerGroup}
      />
      <View className="switch-field">
        <Text className="ntr-field__label">设置三四名决赛</Text>
        <Switch
          checked={enableThirdPlace}
          color="#1f9d66"
          onChange={(e) => onEnableThirdPlace(e.detail.value)}
        />
      </View>
    </View>
  );
}
