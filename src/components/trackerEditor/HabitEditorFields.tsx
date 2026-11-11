import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../ChoiceChip';
import QuietText from '../QuietText';
import SegmentedControl from '../SegmentedControl';
import { SettingsSwitch } from '../settings';
import { FilledField } from '../sheet';
import { typeScale } from '../../theme/typography';
import type { TFunction } from 'i18next';
import { getDateLocale } from '../../i18n';
import {
  LOCK_SCREEN_NAME_MAX,
  parseLocalDate,
  toDateString,
  type HabitTrackingMode,
} from '../../protocol';
import { withReminderTime } from '../../utils/reminderTimes';
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

const SCHEDULE_TYPES: readonly HabitScheduleType[] = ['daily', 'weekdays', 'every_n_days'];
const SCHEDULE_LABEL_KEY: Record<HabitScheduleType, string> = {
  daily: 'habitFields.everyDay',
  weekdays: 'habitFields.specificDays',
  every_n_days: 'habitFields.everyNDays',
};

/** What the closed Repeat row says it is set to. */
function repeatSummary(state: HabitEditorFieldState, t: TFunction): string {
  if (state.scheduleType === 'weekdays') {
    if (state.scheduleWeekdays.length === 0) return t('habitFields.specificDays');
    // Monday first, the way the week reads; Sunday is stored as 0.
    return [...state.scheduleWeekdays]
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((day) => t(`habitFields.${WEEKDAY_KEYS[day]}`))
      .join(', ');
  }
  if (state.scheduleType === 'every_n_days') {
    const interval = parseInt(state.scheduleInterval.trim(), 10);
    return Number.isFinite(interval) && interval > 0
      ? t('habitFields.everyNPreset', { count: interval })
      : t('habitFields.everyNDays');
  }
  return t('habitFields.everyDay');
}

type Props = {
  state: HabitEditorFieldState;
  onChange: (patch: Partial<HabitEditorFieldState>) => void;
};

/** Clock times to be reminded at on each due day; the same row for check-off and timer habits. */
function RemindersSection({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  const theme = useTheme();
  const [draftInvalid, setDraftInvalid] = useState(false);

  const addDraft = () => {
    const reminderTimes = withReminderTime(state.reminderTimes, state.reminderTimeDraft);
    if (!reminderTimes) {
      setDraftInvalid(true);
      return;
    }
    onChange({ reminderTimes, reminderTimeDraft: '' });
  };

  return (
    <FormSection
      title={t('habitFields.remindersSectionTitle')}
      description={t('habitFields.remindersSectionDescription')}
      collapsible
      defaultCollapsed
      value={
        state.reminderTimes.length > 0
          ? state.reminderTimes.join(', ')
          : t('habitFields.remindersOff')
      }
    >
      {state.reminderTimes.map((time) => (
        <View key={time} style={styles.switchRow}>
          <Text style={[typeScale.body, typeScale.data, styles.switchLabel]}>{time}</Text>
          <IconButton
            icon="close"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() =>
              onChange({ reminderTimes: state.reminderTimes.filter((other) => other !== time) })
            }
            accessibilityLabel={t('habitFields.removeReminderTimeA11y', { time })}
          />
        </View>
      ))}
      <View style={styles.timeRow}>
        <FilledField
          placeholder={t('habitFields.reminderTimePlaceholder')}
          value={state.reminderTimeDraft}
          onChangeText={(reminderTimeDraft) => {
            setDraftInvalid(false);
            onChange({ reminderTimeDraft });
          }}
          onSubmitEditing={addDraft}
          keyboardType="numbers-and-punctuation"
          error={draftInvalid ? t('validation.reminderTimeFormat') : null}
          style={styles.timeField}
        />
        <Button
          mode="text"
          compact
          onPress={addDraft}
          disabled={!state.reminderTimeDraft.trim()}
          accessibilityLabel={t('habitFields.addReminderTimeA11y')}
        >
          {t('habitFields.addReminderTime')}
        </Button>
      </View>
    </FormSection>
  );
}

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
        <SegmentedControl
          value={state.habitTrackingMode}
          onChange={(value: HabitTrackingMode) => onChange({ habitTrackingMode: value })}
          options={[
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
          <FilledField
            label={t('habitFields.noteLabel')}
            placeholder={t('habitFields.notePlaceholder')}
            value={state.targetLabel}
            onChangeText={(targetLabel) => onChange({ targetLabel })}
          />
        )}
      </FormSection>

      <FormSection
        title={t('habitFields.lockScreenSectionTitle')}
        description={t('habitFields.lockScreenSectionDescription')}
        collapsible
        defaultCollapsed
        value={state.lockScreenName.trim() || t('habitFields.lockScreenNameOff')}
      >
        <FilledField
          label={t('habitFields.lockScreenNameLabel')}
          placeholder={t('habitFields.lockScreenNamePlaceholder')}
          value={state.lockScreenName}
          onChangeText={(lockScreenName) => onChange({ lockScreenName })}
          maxLength={LOCK_SCREEN_NAME_MAX}
        />
      </FormSection>

      <FormSection
        title={t('habitFields.streakSectionTitle')}
        collapsible
        defaultCollapsed
        value={state.showStreakOnCard ? t('editor.streakShown') : t('editor.streakHidden')}
      >
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={typeScale.body}>{t('habitFields.showStreakLabel')}</Text>
            <QuietText style={[typeScale.caption, styles.hint]}>
              {t('habitFields.showStreakHint')}
            </QuietText>
          </View>
          <SettingsSwitch
            value={state.showStreakOnCard}
            onValueChange={(showStreakOnCard) => onChange({ showStreakOnCard })}
            accessibilityLabel={t('habitFields.showStreakLabel')}
          />
        </View>
      </FormSection>

      <FormSection
        title={t('habitFields.repeatSectionTitle')}
        description={t('habitFields.repeatSectionDescription')}
        collapsible
        defaultCollapsed
        value={repeatSummary(state, t)}
      >
        <View
          style={styles.chipRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('habitFields.repeatSectionTitle')}
        >
          {SCHEDULE_TYPES.map((type) => (
            <ChoiceChip
              key={type}
              label={t(SCHEDULE_LABEL_KEY[type])}
              selected={state.scheduleType === type}
              onPress={() => setScheduleType(type)}
            />
          ))}
        </View>
        {state.scheduleType === 'weekdays' ? (
          <View style={styles.chipRow}>
            {WEEKDAY_KEYS.map((key, value) => (
              <ChoiceChip
                key={value}
                role="checkbox"
                label={t(`habitFields.${key}`)}
                selected={state.scheduleWeekdays.includes(value)}
                onPress={() => toggleWeekday(value)}
              />
            ))}
          </View>
        ) : null}
        {state.scheduleType === 'every_n_days' ? (
          <View style={styles.sectionBody}>
            <QuietText style={typeScale.caption}>{t('habitFields.intervalLabel')}</QuietText>
            <View style={styles.chipRow} accessibilityRole="radiogroup">
              {INTERVAL_PRESETS.map((preset) => (
                <ChoiceChip
                  key={preset}
                  label={t('habitFields.everyNPreset', { count: preset })}
                  selected={knownPreset === String(preset)}
                  onPress={() => onChange({ scheduleInterval: String(preset) })}
                />
              ))}
              <ChoiceChip
                label={t('habitFields.custom')}
                selected={knownPreset === 'custom'}
                onPress={() => {
                  if (knownPreset !== 'custom') {
                    onChange({ scheduleInterval: '4' });
                  }
                }}
              />
            </View>
            {knownPreset === 'custom' ? (
              <FilledField
                label={t('habitFields.everyNDaysLabel')}
                placeholder={t('habitFields.everyNDaysPlaceholder')}
                value={state.scheduleInterval}
                onChangeText={(scheduleInterval) => onChange({ scheduleInterval })}
                keyboardType="number-pad"
              />
            ) : null}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={typeScale.body}>{t('habitFields.firstDayLabel')}</Text>
                <QuietText style={[typeScale.caption, styles.hint]}>
                  {formatAnchorLabel(state.scheduleAnchorDate || today, locale)}
                </QuietText>
              </View>
              <Button
                mode="text"
                compact
                onPress={() => onChange({ scheduleAnchorDate: today })}
                disabled={state.scheduleAnchorDate === today}
              >
                {t('habitFields.startToday')}
              </Button>
            </View>
            <FilledField
              label={t('habitFields.firstDayFieldLabel')}
              placeholder={today}
              value={state.scheduleAnchorDate}
              onChangeText={(scheduleAnchorDate) => onChange({ scheduleAnchorDate })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <QuietText style={[typeScale.caption, styles.hint]}>
              {everyNDaysSummary(state.scheduleInterval, state.scheduleAnchorDate, locale, t)}
            </QuietText>
          </View>
        ) : null}
      </FormSection>

      <RemindersSection state={state} onChange={onChange} />

      <FormSection
        title={t('habitFields.timeWindowSectionTitle')}
        description={t('habitFields.timeWindowSectionDescription')}
        collapsible
        defaultCollapsed
        value={
          state.useTimeRange && state.timeRangeStart && state.timeRangeEnd
            ? `${state.timeRangeStart}–${state.timeRangeEnd}`
            : t('habitFields.timeWindowOff')
        }
      >
        <View style={styles.switchRow}>
          <Text style={[typeScale.body, styles.switchLabel]}>
            {t('habitFields.useTimeRangeLabel')}
          </Text>
          <SettingsSwitch
            value={state.useTimeRange}
            onValueChange={(useTimeRange) => onChange({ useTimeRange })}
            accessibilityLabel={t('habitFields.useTimeRangeLabel')}
          />
        </View>
        {state.useTimeRange ? (
          <View style={styles.sectionBody}>
            <View style={styles.timeRow}>
              <FilledField
                label={t('habitFields.fromLabel')}
                placeholder={t('habitFields.fromPlaceholder')}
                value={state.timeRangeStart}
                onChangeText={(timeRangeStart) => onChange({ timeRangeStart })}
                keyboardType="numbers-and-punctuation"
                style={styles.timeField}
              />
              <FilledField
                label={t('habitFields.toLabel')}
                placeholder={t('habitFields.toPlaceholder')}
                value={state.timeRangeEnd}
                onChangeText={(timeRangeEnd) => onChange({ timeRangeEnd })}
                keyboardType="numbers-and-punctuation"
                style={styles.timeField}
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={typeScale.body}>{t('habitFields.onlyShowDuringWindowLabel')}</Text>
                <QuietText style={[typeScale.caption, styles.hint]}>
                  {t('habitFields.onlyShowDuringWindowHint')}
                </QuietText>
              </View>
              <SettingsSwitch
                value={state.visibleOnlyInTimeRange}
                onValueChange={(visibleOnlyInTimeRange) => onChange({ visibleOnlyInTimeRange })}
                accessibilityLabel={t('habitFields.onlyShowDuringWindowLabel')}
              />
            </View>
            {state.scheduleType === 'every_n_days' ? (
              <QuietText style={[typeScale.caption, styles.hint]}>
                {t('habitFields.everyNDaysReminderUnavailableHint')}
              </QuietText>
            ) : (
              <>
                <View style={styles.switchRow}>
                  <Text style={[typeScale.body, styles.switchLabel]}>
                    {t('habitFields.reminderBeforeStartLabel')}
                  </Text>
                  <SettingsSwitch
                    value={state.useReminder}
                    onValueChange={(useReminder) => onChange({ useReminder })}
                    accessibilityLabel={t('habitFields.reminderBeforeStartLabel')}
                  />
                </View>
                {state.useReminder ? (
                  <FilledField
                    label={t('habitFields.minutesBeforeLabel')}
                    placeholder={t('habitFields.minutesBeforePlaceholder')}
                    value={state.remindMinutesBefore}
                    onChangeText={(remindMinutesBefore) => onChange({ remindMinutesBefore })}
                    keyboardType="number-pad"
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
