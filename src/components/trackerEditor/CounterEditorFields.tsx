import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import FormSection, { formSectionStyles as styles } from './FormSection';

const PRESET_INCREMENTS = [1, 5, 10, 25, 50, 100] as const;

type Props = {
  increments: string;
  dailyTarget: string;
  onIncrementsChange: (value: string) => void;
  onDailyTargetChange: (value: string) => void;
};

function parseIncrementList(raw: string): number[] {
  const seen = new Set<number>();
  const values: number[] = [];
  for (const part of raw.split(',')) {
    const value = parseInt(part.trim(), 10);
    if (Number.isNaN(value) || value <= 0 || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function formatIncrementList(values: number[]): string {
  return values.join(', ');
}

export default function CounterEditorFields({
  increments,
  dailyTarget,
  onIncrementsChange,
  onDailyTargetChange,
}: Props) {
  const [customValue, setCustomValue] = useState('');
  const values = parseIncrementList(increments);

  const commit = (next: number[]) => {
    onIncrementsChange(formatIncrementList(next));
  };

  const addValue = (value: number) => {
    if (values.includes(value)) return;
    commit([...values, value].sort((a, b) => a - b));
  };

  const removeValue = (value: number) => {
    commit(values.filter((item) => item !== value));
  };

  const togglePreset = (value: number) => {
    if (values.includes(value)) {
      removeValue(value);
      return;
    }
    addValue(value);
  };

  const addCustom = () => {
    const value = parseInt(customValue.trim(), 10);
    if (Number.isNaN(value) || value <= 0) return;
    addValue(value);
    setCustomValue('');
  };

  return (
    <FormSection
      title="Counter settings"
      description="Quick buttons add to today's total (resets at midnight). Daily target is optional."
    >
      <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
        Quick buttons
      </Text>
      {values.length > 0 ? (
        <View style={[styles.chipRow, styles.field]}>
          {values.map((value) => (
            <Chip
              key={value}
              onClose={() => removeValue(value)}
              compact
              style={styles.weekdayChip}
            >
              +{value}
            </Chip>
          ))}
        </View>
      ) : (
        <Text variant="bodySmall" style={[styles.hint, styles.field]}>
          Add at least one button below.
        </Text>
      )}

      <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
        Tap to add
      </Text>
      <View style={[styles.chipRow, styles.field]}>
        {PRESET_INCREMENTS.map((preset) => (
          <Chip
            key={preset}
            selected={values.includes(preset)}
            onPress={() => togglePreset(preset)}
            compact
            style={styles.weekdayChip}
          >
            +{preset}
          </Chip>
        ))}
      </View>

      <View style={[styles.timeRow, styles.field]}>
        <TextInput
          label="Custom"
          placeholder="e.g. 3"
          value={customValue}
          onChangeText={setCustomValue}
          keyboardType="number-pad"
          mode="outlined"
          style={styles.timeField}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Button
          mode="outlined"
          onPress={addCustom}
          disabled={!customValue.trim()}
          style={{ alignSelf: 'center' }}
        >
          Add
        </Button>
      </View>

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
