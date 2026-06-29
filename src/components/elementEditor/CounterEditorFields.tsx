import React from 'react';
import { TextInput } from 'react-native-paper';
import FormSection, { formSectionStyles as styles } from './FormSection';

type Props = {
  increments: string;
  dailyTarget: string;
  onIncrementsChange: (value: string) => void;
  onDailyTargetChange: (value: string) => void;
};

export default function CounterEditorFields({
  increments,
  dailyTarget,
  onIncrementsChange,
  onDailyTargetChange,
}: Props) {
  return (
    <FormSection
      title="Counter settings"
      description="Quick buttons add to today's total. Daily target is optional."
    >
      <TextInput
        label="Quick increments"
        placeholder="5, 10, 25"
        value={increments}
        onChangeText={onIncrementsChange}
        keyboardType="numbers-and-punctuation"
        mode="outlined"
        style={styles.field}
      />
      <TextInput
        label="Daily target (optional)"
        placeholder="e.g. 50"
        value={dailyTarget}
        onChangeText={onDailyTargetChange}
        keyboardType="number-pad"
        mode="outlined"
      />
    </FormSection>
  );
}
