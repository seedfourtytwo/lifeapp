import React from 'react';
import { View } from 'react-native';
import { Button, Chip, Divider, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getDateLocale } from '../../i18n';
import { parseLocalDate, toDateString, type HabitTrackingMode } from '../../protocol';
import FormSection, { formSectionStyles as styles } from './FormSection';
import HabitSoundEditorFields from './HabitSoundEditorFields';
import type { HabitEditorFieldState, HabitScheduleType } from './types';

const WEEKDAY_KEYS = [
  'weekdaySun',
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
] as const;

const INTERVAL_PRESETS = [2, 3, 7] as const;

function formatAnchorLabel(dateStr: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function everyNDaysSummary(
  intervalRaw: string,
  anchorDate: string,
  locale: string,
  t: TFunction,
): string {
  const interval = parseInt(intervalRaw.trim(), 10);
  if (Number.isNaN(interval) || interval < 1) {
    return t('habitFields.enterIntervalHint');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    return t('habitFields.setFirstDayHint');
  }
  if (interval === 1) {
    return t('habitFields.dueEveryDayFromHint', { date: formatAnchorLabel(anchorDate, locale) });
  }
  return t('habitFields.dueEveryNDaysFromHint', {
    count: interval,
    date: formatAnchorLabel(anchorDate, locale),
  });
}

type Props = {
  state: HabitEditorFieldState;
  onChange: (patch: Partial<HabitEditorFieldState>) => void;
};

/**
 * Memoized: a keystroke in the editor's name field re-renders the dialog, and
 * these props are referentially stable, so re-rendering here is pure waste that
 * used to starve the name TextInput. See __tests__/trackerEditorRerender.test.ts.
 */
function HabitEditorFields({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  const locale = getDateLocale();
  const toggleWeekday = (day: number) => {
    const next = state.scheduleWeekdays.includes(day)
      ? state.scheduleWeekdays.filter((d) => d !== day)
      : [...state.scheduleWeekdays, day].sort();
    onChange({ scheduleWeekdays: next });
  };

  const setScheduleType = (next: HabitScheduleType) => {
    onChange({
      scheduleType: next,
      ...(next === 'every_n_days'
        ? {
            useReminder: false,
            scheduleAnchorDate: state.scheduleAnchorDate || toDateString(new Date()),
          }
        : {}),
    });
  };

  const today = toDateString(new Date());
  const intervalValue = parseInt(state.scheduleInterval.trim(), 10);
  const knownPreset =
    Number.isFinite(intervalValue) &&
    INTERVAL_PRESETS.includes(intervalValue as (typeof INTERVAL_PRESETS)[number])
      ? String(intervalValue)
      : 'custom';

  return (
    <>
      <FormSection title={t('habitFields.typeSectionTitle')}>
        <SegmentedButtons
          value={state.habitTrackingMode}
          onValueChange={(value) => {
            if (value) onChange({ habitTrackingMode: value as HabitTrackingMode });
          }}
          buttons={[
            { value: 'boolean', label: t('habitFields.checkOff') },
            { value: 'timer', label: t('habitFields.timer') },
          ]}
        />
        {state.habitTrackingMode === 'timer' ? (
          <HabitSoundEditorFields
            dailyGoalMinutes={state.habitDailyGoalMinutes}
            sound={{
              habitSoundTrackId: state.habitSoundTrackId,
              habitSoundPlaybackMode: state.habitSoundPlaybackMode,
            }}
            onDailyGoalMinutesChange={(habitDailyGoalMinutes) =>
              onChange({ habitDailyGoalMinutes })
            }
            onSoundChange={(patch) => onChange(patch)}
          />
        ) : (
          <TextInput
            label={t('habitFields.noteLabel')}
            placeholder={t('habitFields.notePlaceholder')}
            value={state.targetLabel}
            onChangeText={(targetLabel) => onChange({ targetLabel })}
            mode="outlined"
            style={styles.field}
          />
        )}
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title={t('habitFields.streakSectionTitle')}
        description={t('habitFields.streakSectionDescription')}
        collapsible
        defaultCollapsed={!state.showStreakOnCard}
      >
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text variant="bodyMedium">{t('habitFields.showStreakLabel')}</Text>
            <Text variant="bodySmall" style={styles.hint}>
              {t('habitFields.showStreakHint')}
            </Text>
          </View>
          <Switch
            value={state.showStreakOnCard}
            onValueChange={(showStreakOnCard) => onChange({ showStreakOnCard })}
          />
        </View>
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title={t('habitFields.repeatSectionTitle')}
        description={t('habitFields.repeatSectionDescription')}
        collapsible
        defaultCollapsed={state.scheduleType === 'daily'}
      >
        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            if (value) setScheduleType(value as HabitScheduleType);
          }}
          buttons={[
            { value: 'daily', label: t('habitFields.everyDay') },
            { value: 'weekdays', label: t('habitFields.specificDays') },
          ]}
          style={styles.field}
        />
        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            if (value) setScheduleType(value as HabitScheduleType);
          }}
          buttons={[{ value: 'every_n_days', label: t('habitFields.everyNDays') }]}
        />
        {state.scheduleType === 'weekdays' ? (
          <View style={[styles.weekdayRow, styles.sectionBody]}>
            {WEEKDAY_KEYS.map((key, value) => (
              <Chip
                key={value}
                selected={state.scheduleWeekdays.includes(value)}
                onPress={() => toggleWeekday(value)}
                compact
                style={styles.weekdayChip}
              >
                {t(`habitFields.${key}`)}
              </Chip>
            ))}
          </View>
        ) : null}
        {state.scheduleType === 'every_n_days' ? (
          <View style={styles.sectionBody}>
            <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
              {t('habitFields.intervalLabel')}
            </Text>
            <View style={[styles.chipRow, styles.field]}>
              {INTERVAL_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  selected={knownPreset === String(preset)}
                  onPress={() => onChange({ scheduleInterval: String(preset) })}
                  compact
                >
                  {t('habitFields.everyNPreset', { count: preset })}
                </Chip>
              ))}
              <Chip
                selected={knownPreset === 'custom'}
                onPress={() => {
                  if (knownPreset !== 'custom') {
                    onChange({ scheduleInterval: '4' });
                  }
                }}
                compact
              >
                {t('habitFields.custom')}
              </Chip>
            </View>
            {knownPreset === 'custom' ? (
              <TextInput
                label={t('habitFields.everyNDaysLabel')}
                placeholder={t('habitFields.everyNDaysPlaceholder')}
                value={state.scheduleInterval}
                onChangeText={(scheduleInterval) => onChange({ scheduleInterval })}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.field}
              />
            ) : null}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">{t('habitFields.firstDayLabel')}</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  {formatAnchorLabel(state.scheduleAnchorDate || today, locale)}
                </Text>
              </View>
              <Button
                mode="outlined"
                compact
                onPress={() => onChange({ scheduleAnchorDate: today })}
                disabled={state.scheduleAnchorDate === today}
              >
                {t('habitFields.startToday')}
              </Button>
            </View>
            <TextInput
              label={t('habitFields.firstDayFieldLabel')}
              placeholder={today}
              value={state.scheduleAnchorDate}
              onChangeText={(scheduleAnchorDate) => onChange({ scheduleAnchorDate })}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={styles.field}
            />
            <Text variant="bodySmall" style={styles.hint}>
              {everyNDaysSummary(state.scheduleInterval, state.scheduleAnchorDate, locale, t)}
            </Text>
          </View>
        ) : null}
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title={t('habitFields.timeWindowSectionTitle')}
        description={t('habitFields.timeWindowSectionDescription')}
        collapsible
        defaultCollapsed={!state.useTimeRange}
      >
        <View style={styles.switchRow}>
          <Text variant="bodyMedium">{t('habitFields.useTimeRangeLabel')}</Text>
          <Switch
            value={state.useTimeRange}
            onValueChange={(useTimeRange) => onChange({ useTimeRange })}
          />
        </View>
        {state.useTimeRange ? (
          <View style={styles.sectionBody}>
            <View style={styles.timeRow}>
              <TextInput
                label={t('habitFields.fromLabel')}
                placeholder={t('habitFields.fromPlaceholder')}
                value={state.timeRangeStart}
                onChangeText={(timeRangeStart) => onChange({ timeRangeStart })}
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeField}
              />
              <TextInput
                label={t('habitFields.toLabel')}
                placeholder={t('habitFields.toPlaceholder')}
                value={state.timeRangeEnd}
                onChangeText={(timeRangeEnd) => onChange({ timeRangeEnd })}
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeField}
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">{t('habitFields.onlyShowDuringWindowLabel')}</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  {t('habitFields.onlyShowDuringWindowHint')}
                </Text>
              </View>
              <Switch
                value={state.visibleOnlyInTimeRange}
                onValueChange={(visibleOnlyInTimeRange) => onChange({ visibleOnlyInTimeRange })}
              />
            </View>
            {state.scheduleType === 'every_n_days' ? (
              <Text variant="bodySmall" style={styles.hint}>
                {t('habitFields.everyNDaysReminderUnavailableHint')}
              </Text>
            ) : (
              <>
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">{t('habitFields.reminderBeforeStartLabel')}</Text>
                  <Switch
                    value={state.useReminder}
                    onValueChange={(useReminder) => onChange({ useReminder })}
                  />
                </View>
                {state.useReminder ? (
                  <TextInput
                    label={t('habitFields.minutesBeforeLabel')}
                    placeholder={t('habitFields.minutesBeforePlaceholder')}
                    value={state.remindMinutesBefore}
                    onChangeText={(remindMinutesBefore) => onChange({ remindMinutesBefore })}
                    keyboardType="number-pad"
                    mode="outlined"
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </FormSection>
    </>
  );
}

export default React.memo(HabitEditorFields);
