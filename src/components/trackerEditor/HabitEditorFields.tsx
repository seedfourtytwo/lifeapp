import React from 'react';
import { View } from 'react-native';
import { Button, Chip, Divider, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { toDateString, type HabitTrackingMode } from '../../protocol';
import FormSection, { formSectionStyles as styles } from './FormSection';
import HabitSoundEditorFields from './HabitSoundEditorFields';
import type { HabitEditorFieldState, HabitScheduleType } from './types';

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const INTERVAL_PRESETS = [2, 3, 7] as const;

function formatAnchorLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function everyNDaysSummary(intervalRaw: string, anchorDate: string): string {
  const interval = parseInt(intervalRaw.trim(), 10);
  if (Number.isNaN(interval) || interval < 1) {
    return 'Enter how often this habit repeats.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    return 'Set a first day (YYYY-MM-DD).';
  }
  if (interval === 1) {
    return `Due every day from ${formatAnchorLabel(anchorDate)}.`;
  }
  return `Due every ${interval} days from ${formatAnchorLabel(anchorDate)}.`;
}

type Props = {
  state: HabitEditorFieldState;
  onChange: (patch: Partial<HabitEditorFieldState>) => void;
};

export default function HabitEditorFields({ state, onChange }: Props) {
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
      <FormSection title="Type">
        <SegmentedButtons
          value={state.habitTrackingMode}
          onValueChange={(value) => {
            if (value) onChange({ habitTrackingMode: value as HabitTrackingMode });
          }}
          buttons={[
            { value: 'boolean', label: 'Check off' },
            { value: 'timer', label: 'Timer' },
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
            label="Note (optional)"
            placeholder="e.g. 1 cup, stretch"
            value={state.targetLabel}
            onChangeText={(targetLabel) => onChange({ targetLabel })}
            mode="outlined"
            style={styles.field}
          />
        )}
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title="Streak"
        description="Optional streak badge on the habit card."
        collapsible
        defaultCollapsed={!state.showStreakOnCard}
      >
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text variant="bodyMedium">Show streak on card</Text>
            <Text variant="bodySmall" style={styles.hint}>
              Success or missed-day streak for check-off and timer habits
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
        title="Repeat"
        description="Which days this habit is due. Off days stay off the Habits list and do not break streaks."
        collapsible
        defaultCollapsed={state.scheduleType === 'daily'}
      >
        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            if (value) setScheduleType(value as HabitScheduleType);
          }}
          buttons={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Specific days' },
          ]}
          style={styles.field}
        />
        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            if (value) setScheduleType(value as HabitScheduleType);
          }}
          buttons={[{ value: 'every_n_days', label: 'Every N days' }]}
        />
        {state.scheduleType === 'weekdays' ? (
          <View style={[styles.weekdayRow, styles.sectionBody]}>
            {WEEKDAY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={state.scheduleWeekdays.includes(option.value)}
                onPress={() => toggleWeekday(option.value)}
                compact
                style={styles.weekdayChip}
              >
                {option.label}
              </Chip>
            ))}
          </View>
        ) : null}
        {state.scheduleType === 'every_n_days' ? (
          <View style={styles.sectionBody}>
            <Text variant="bodySmall" style={[styles.hint, styles.inlineLabel]}>
              Interval
            </Text>
            <View style={[styles.chipRow, styles.field]}>
              {INTERVAL_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  selected={knownPreset === String(preset)}
                  onPress={() => onChange({ scheduleInterval: String(preset) })}
                  compact
                >
                  Every {preset}
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
                Custom
              </Chip>
            </View>
            {knownPreset === 'custom' ? (
              <TextInput
                label="Every N days"
                placeholder="4"
                value={state.scheduleInterval}
                onChangeText={(scheduleInterval) => onChange({ scheduleInterval })}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.field}
              />
            ) : null}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">First day</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  {formatAnchorLabel(state.scheduleAnchorDate || today)}
                </Text>
              </View>
              <Button
                mode="outlined"
                compact
                onPress={() => onChange({ scheduleAnchorDate: today })}
                disabled={state.scheduleAnchorDate === today}
              >
                Start today
              </Button>
            </View>
            <TextInput
              label="First day (YYYY-MM-DD)"
              placeholder={today}
              value={state.scheduleAnchorDate}
              onChangeText={(scheduleAnchorDate) => onChange({ scheduleAnchorDate })}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={styles.field}
            />
            <Text variant="bodySmall" style={styles.hint}>
              {everyNDaysSummary(state.scheduleInterval, state.scheduleAnchorDate)}
            </Text>
          </View>
        ) : null}
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title="Time window"
        description="Optional. Limit when the habit shows on the Habits tab, and set a reminder before it starts."
        collapsible
        defaultCollapsed={!state.useTimeRange}
      >
        <View style={styles.switchRow}>
          <Text variant="bodyMedium">Use a daily time range</Text>
          <Switch
            value={state.useTimeRange}
            onValueChange={(useTimeRange) => onChange({ useTimeRange })}
          />
        </View>
        {state.useTimeRange ? (
          <View style={styles.sectionBody}>
            <View style={styles.timeRow}>
              <TextInput
                label="From"
                placeholder="06:00"
                value={state.timeRangeStart}
                onChangeText={(timeRangeStart) => onChange({ timeRangeStart })}
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeField}
              />
              <TextInput
                label="To"
                placeholder="09:00"
                value={state.timeRangeEnd}
                onChangeText={(timeRangeEnd) => onChange({ timeRangeEnd })}
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeField}
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">Only show during this window</Text>
                <Text variant="bodySmall" style={styles.hint}>
                  Hidden outside this time on Habits
                </Text>
              </View>
              <Switch
                value={state.visibleOnlyInTimeRange}
                onValueChange={(visibleOnlyInTimeRange) => onChange({ visibleOnlyInTimeRange })}
              />
            </View>
            {state.scheduleType === 'every_n_days' ? (
              <Text variant="bodySmall" style={styles.hint}>
                Reminders are not available for every-N-days schedules yet.
              </Text>
            ) : (
              <>
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">Reminder before start</Text>
                  <Switch
                    value={state.useReminder}
                    onValueChange={(useReminder) => onChange({ useReminder })}
                  />
                </View>
                {state.useReminder ? (
                  <TextInput
                    label="Minutes before"
                    placeholder="15"
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
