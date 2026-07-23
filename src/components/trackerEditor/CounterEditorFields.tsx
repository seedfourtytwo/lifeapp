import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Divider, Switch, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import FormSection, { formSectionStyles as styles } from './FormSection';

const PRESET_INCREMENTS = [1, 5, 10, 25, 50, 100] as const;

type Props = {
  increments: string;
  dailyTarget: string;
  showStreakOnCard: boolean;
  onIncrementsChange: (value: string) => void;
  onDailyTargetChange: (value: string) => void;
  onShowStreakOnCardChange: (value: boolean) => void;
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

function hasPositiveDailyTarget(raw: string): boolean {
  const value = parseInt(raw.trim(), 10);
  return !Number.isNaN(value) && value > 0;
}

export default function CounterEditorFields({
  increments,
  dailyTarget,
  showStreakOnCard,
  onIncrementsChange,
  onDailyTargetChange,
  onShowStreakOnCardChange,
}: Props) {
  const { t } = useTranslation('trackers');
  const [customValue, setCustomValue] = useState('');
  const values = parseIncrementList(increments);
  const showStreakToggle = hasPositiveDailyTarget(dailyTarget);

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
    <>
      <FormSection
        title={t('counterFields.sectionTitle')}
        description={t('counterFields.sectionDescription')}
      >
        <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
          {t('counterFields.quickButtonsLabel')}
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
            {t('counterFields.quickButtonsEmptyHint')}
          </Text>
        )}

        <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
          {t('counterFields.tapToAddLabel')}
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
            label={t('counterFields.customLabel')}
            placeholder={t('counterFields.customPlaceholder')}
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
            {t('counterFields.add')}
          </Button>
        </View>

        <TextInput
          label={t('counterFields.dailyTargetLabel')}
          placeholder={t('counterFields.dailyTargetPlaceholder')}
          value={dailyTarget}
          onChangeText={onDailyTargetChange}
          keyboardType="number-pad"
          mode="outlined"
        />
      </FormSection>

      {showStreakToggle ? (
        <>
          <Divider style={styles.divider} />
          <FormSection
            title={t('counterFields.streakSectionTitle')}
            description={t('counterFields.streakSectionDescription')}
            collapsible
            defaultCollapsed={!showStreakOnCard}
          >
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">{t('counterFields.showStreakLabel')}</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  {t('counterFields.showStreakHint')}
                </Text>
              </View>
              <Switch
                value={showStreakOnCard}
                onValueChange={onShowStreakOnCardChange}
              />
            </View>
          </FormSection>
        </>
      ) : null}
    </>
  );
}
