import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../ChoiceChip';
import QuietText from '../QuietText';
import { SettingsSwitch } from '../settings';
import { FilledField } from '../sheet';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import FormSection, { formSectionStyles as styles } from './FormSection';
import type { TrackerEditorProblemProps } from './types';

const PRESET_INCREMENTS = [1, 5, 10, 25, 50, 100] as const;

type Props = {
  increments: string;
  dailyTarget: string;
  showStreakOnCard: boolean;
  onIncrementsChange: (value: string) => void;
  onDailyTargetChange: (value: string) => void;
  onShowStreakOnCardChange: (value: boolean) => void;
} & TrackerEditorProblemProps;

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

/**
 * Memoized: a keystroke in the editor's name field re-renders the dialog, and
 * these props are referentially stable, so re-rendering here is pure waste that
 * used to starve the name TextInput. See __tests__/trackerEditorRerender.test.ts.
 */
function CounterEditorFields({
  increments,
  dailyTarget,
  showStreakOnCard,
  onIncrementsChange,
  onDailyTargetChange,
  onShowStreakOnCardChange,
  problem = null,
  anchorRef,
}: Props) {
  const { t } = useTranslation('trackers');
  const problemFor = (field: NonNullable<typeof problem>['field']) =>
    problem?.field === field ? problem.message : null;
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
        <QuietText style={typeScale.caption}>{t('counterFields.quickButtonsLabel')}</QuietText>
        {values.length > 0 ? (
          <View style={styles.chipRow}>
            {values.map((value) => (
              <RemovableStep
                key={value}
                value={value}
                onRemove={() => removeValue(value)}
                accessibilityLabel={t('counterFields.removeA11y', { value })}
              />
            ))}
          </View>
        ) : (
          <QuietText style={[typeScale.caption, styles.hint]}>
            {t('counterFields.quickButtonsEmptyHint')}
          </QuietText>
        )}

        <QuietText style={typeScale.caption}>{t('counterFields.tapToAddLabel')}</QuietText>
        <View style={styles.chipRow}>
          {PRESET_INCREMENTS.map((preset) => (
            <ChoiceChip
              key={preset}
              role="checkbox"
              label={`+${preset}`}
              selected={values.includes(preset)}
              onPress={() => togglePreset(preset)}
            />
          ))}
        </View>

        <View style={styles.timeRow}>
          <FilledField
            label={t('counterFields.customLabel')}
            placeholder={t('counterFields.customPlaceholder')}
            value={customValue}
            onChangeText={setCustomValue}
            keyboardType="number-pad"
            style={styles.timeField}
            onSubmitEditing={addCustom}
            returnKeyType="done"
            error={problemFor('increments')}
            ref={anchorRef?.('increments')}
          />
          <Button
            mode="text"
            onPress={addCustom}
            disabled={!customValue.trim()}
            style={local.addButton}
          >
            {t('counterFields.add')}
          </Button>
        </View>

        <FilledField
          label={t('counterFields.dailyTargetLabel')}
          placeholder={t('counterFields.dailyTargetPlaceholder')}
          value={dailyTarget}
          onChangeText={onDailyTargetChange}
          keyboardType="number-pad"
          error={problemFor('dailyTarget')}
          ref={anchorRef?.('dailyTarget')}
        />
      </FormSection>

      {showStreakToggle ? (
        <FormSection
          title={t('counterFields.streakSectionTitle')}
          description={t('counterFields.streakSectionDescription')}
          collapsible
          defaultCollapsed={!showStreakOnCard}
          value={showStreakOnCard ? t('editor.streakShown') : t('editor.streakHidden')}
        >
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={typeScale.body}>{t('counterFields.showStreakLabel')}</Text>
              <QuietText style={[typeScale.caption, styles.hint]}>
                {t('counterFields.showStreakHint')}
              </QuietText>
            </View>
            <SettingsSwitch
              value={showStreakOnCard}
              onValueChange={onShowStreakOnCardChange}
              accessibilityLabel={t('counterFields.showStreakLabel')}
            />
          </View>
        </FormSection>
      ) : null}
    </>
  );
}

/** A quick button the counter already has: a moss pill that drops it on tap. */
function RemovableStep({
  value,
  onRemove,
  accessibilityLabel,
}: {
  value: number;
  onRemove: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <Pressable
      onPress={onRemove}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[local.step, { backgroundColor: theme.colors.primary, borderRadius: deco.radius.pill }]}
    >
      <Text style={[local.stepLabel, { color: theme.colors.onPrimary }]}>+{value}</Text>
      <MaterialCommunityIcons name="close" size={16} color={theme.colors.onPrimary} />
    </Pressable>
  );
}

const local = StyleSheet.create({
  addButton: {
    alignSelf: 'flex-end',
    marginBottom: space.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingLeft: space.lg,
    paddingRight: space.md,
  },
  stepLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});

export default React.memo(CounterEditorFields);
