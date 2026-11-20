import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../ChoiceChip';
import QuietText from '../QuietText';
import SegmentedControl from '../SegmentedControl';
import { SettingsSwitch } from '../settings';
import { FilledField } from '../sheet';
import { typeScale } from '../../theme/typography';
import type { TFunction } from 'i18next';
import { getDateLocale } from '../../i18n';
import { parseLocalDate, toDateString, type HabitTrackingMode } from '../../protocol';
import FormSection, { FieldProblemText, formSectionStyles as styles } from './FormSection';
import { timeOfDaySummary } from './habitSummaries';
import HabitSoundEditorFields from './HabitSoundEditorFields';
import type { HabitEditorFieldState, HabitScheduleType, TrackerEditorProblemProps } from './types';

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

const SCHEDULE_TYPES: readonly HabitScheduleType[] = [
  'daily',
  'weekdays',
  'every_n_days',
  'times_per_week',
];
const SCHEDULE_LABEL_KEY: Record<HabitScheduleType, string> = {
  daily: 'habitFields.everyDay',
  weekdays: 'habitFields.specificDays',
  every_n_days: 'habitFields.everyNDays',
  times_per_week: 'habitFields.timesPerWeek',
};

/** Seven would be "every day"; that is the daily schedule. */
const TIMES_PER_WEEK_CHOICES = [1, 2, 3, 4, 5, 6] as const;

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
  if (state.scheduleType === 'times_per_week') {
    const times = parseInt(state.scheduleTimesPerWeek.trim(), 10);
    return Number.isFinite(times) && times > 0
      ? t('habitFields.timesPerWeekPreset', { count: times })
      : t('habitFields.timesPerWeek');
  }
  return t('habitFields.everyDay');
}

type Props = {
  state: HabitEditorFieldState;
  onChange: (patch: Partial<HabitEditorFieldState>) => void;
} & TrackerEditorProblemProps;

type ProblemField = NonNullable<TrackerEditorProblemProps['problem']>['field'];
const REPEAT_FIELDS: readonly ProblemField[] = ['weekdays', 'timesPerWeek', 'interval', 'anchorDate'];
const TIME_OF_DAY_FIELDS: readonly ProblemField[] = ['timeRange', 'remindMinutesBefore'];

/**
 * Memoized: a keystroke in the editor's name field re-renders the dialog, and
 * these props are referentially stable, so re-rendering here is pure waste that
 * used to starve the name TextInput. See __tests__/trackerEditorRerender.test.ts.
 */
function HabitEditorFields({ state, onChange, problem = null, anchorRef }: Props) {
  const { t } = useTranslation('trackers');
  const locale = getDateLocale();
  const problemFor = (field: ProblemField) => (problem?.field === field ? problem.message : null);
  const problemIn = (fields: readonly ProblemField[]) =>
    problem && fields.includes(problem.field) ? problem : null;
  const weekdaysProblem = problemFor('weekdays');
  const timesPerWeekProblem = problemFor('timesPerWeek');
  const intervalProblem = problemFor('interval');
  const timeRangeProblem = problemFor('timeRange');
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
        ? { scheduleAnchorDate: state.scheduleAnchorDate || toDateString(new Date()) }
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
            anySessionCounts={state.anySessionCounts}
            onDailyGoalMinutesChange={(habitDailyGoalMinutes) =>
              onChange({ habitDailyGoalMinutes })
            }
            onAnySessionCountsChange={(anySessionCounts) => onChange({ anySessionCounts })}
            onSoundChange={(patch) => onChange(patch)}
            dailyGoalError={problemFor('dailyGoalMinutes')}
            dailyGoalRef={anchorRef?.('dailyGoalMinutes')}
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
        title={t('habitFields.repeatSectionTitle')}
        description={t('habitFields.repeatSectionDescription')}
        collapsible
        defaultCollapsed
        value={repeatSummary(state, t)}
        openFor={problemIn(REPEAT_FIELDS)}
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
          <View style={styles.sectionBody} ref={anchorRef?.('weekdays')} collapsable={false}>
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
            {weekdaysProblem ? <FieldProblemText>{weekdaysProblem}</FieldProblemText> : null}
          </View>
        ) : null}
        {state.scheduleType === 'times_per_week' ? (
          <View style={styles.sectionBody} ref={anchorRef?.('timesPerWeek')} collapsable={false}>
            <QuietText style={typeScale.caption}>{t('habitFields.timesPerWeekLabel')}</QuietText>
            <View
              style={styles.chipRow}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('habitFields.timesPerWeekLabel')}
            >
              {TIMES_PER_WEEK_CHOICES.map((times) => (
                <ChoiceChip
                  key={times}
                  label={String(times)}
                  accessibilityLabel={t('habitFields.timesPerWeekPreset', { count: times })}
                  selected={state.scheduleTimesPerWeek === String(times)}
                  onPress={() => onChange({ scheduleTimesPerWeek: String(times) })}
                />
              ))}
            </View>
            {timesPerWeekProblem ? (
              <FieldProblemText>{timesPerWeekProblem}</FieldProblemText>
            ) : (
              <QuietText style={[typeScale.caption, styles.hint]}>
                {t('habitFields.timesPerWeekHint')}
              </QuietText>
            )}
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
                error={intervalProblem}
                ref={anchorRef?.('interval')}
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
              error={problemFor('anchorDate')}
              ref={anchorRef?.('anchorDate')}
            />
            <QuietText style={[typeScale.caption, styles.hint]}>
              {everyNDaysSummary(state.scheduleInterval, state.scheduleAnchorDate, locale, t)}
            </QuietText>
          </View>
        ) : null}
      </FormSection>

      <FormSection
        title={t('habitFields.timeOfDaySectionTitle')}
        description={t('habitFields.timeOfDaySectionDescription')}
        collapsible
        defaultCollapsed
        value={timeOfDaySummary(state, t)}
        openFor={problemIn(TIME_OF_DAY_FIELDS)}
      >
        <View style={styles.switchRow} ref={anchorRef?.('timeRange')} collapsable={false}>
          <Text style={[typeScale.body, styles.switchLabel]}>
            {t('habitFields.useTimeRangeLabel')}
          </Text>
          <SettingsSwitch
            value={state.useTimeRange}
            onValueChange={(useTimeRange) => onChange({ useTimeRange })}
            accessibilityLabel={t('habitFields.useTimeRangeLabel')}
          />
        </View>
        {timeRangeProblem ? <FieldProblemText>{timeRangeProblem}</FieldProblemText> : null}
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
                error={problemFor('remindMinutesBefore')}
                ref={anchorRef?.('remindMinutesBefore')}
              />
            ) : null}
          </View>
        ) : null}
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
    </>
  );
}

export default React.memo(HabitEditorFields);
