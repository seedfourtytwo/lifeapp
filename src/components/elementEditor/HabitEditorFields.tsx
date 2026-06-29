import React from 'react';
import { View } from 'react-native';
import {
  Chip,
  Divider,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { HabitTimeSlot, HabitTrackingMode, SoundAsset } from '../../protocol';
import FormSection, { formSectionStyles as styles } from './FormSection';
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

type Props = {
  state: HabitEditorFieldState;
  soundOptions: SoundAsset[];
  onChange: (patch: Partial<HabitEditorFieldState>) => void;
};

export default function HabitEditorFields({ state, soundOptions, onChange }: Props) {
  const toggleWeekday = (day: number) => {
    const next = state.scheduleWeekdays.includes(day)
      ? state.scheduleWeekdays.filter((d) => d !== day)
      : [...state.scheduleWeekdays, day].sort();
    onChange({ scheduleWeekdays: next });
  };

  const setScheduleType = (next: HabitScheduleType) => {
    onChange({
      scheduleType: next,
      ...(next === 'every_n_days' ? { useReminder: false } : {}),
    });
  };

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
          <View style={styles.sectionBody}>
            <TextInput
              label="Daily goal (minutes)"
              placeholder="e.g. 15"
              value={state.habitDailyGoalMinutes}
              onChangeText={(habitDailyGoalMinutes) => onChange({ habitDailyGoalMinutes })}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.field}
            />
            <Text variant="labelMedium" style={styles.inlineLabel}>
              Sound while running
            </Text>
            {soundOptions.length === 0 ? (
              <Text variant="bodySmall" style={styles.hint}>
                Add tracks in Settings → Sound tracks.
              </Text>
            ) : (
              <View style={styles.chipRow}>
                <Chip
                  selected={state.habitSoundId === ''}
                  onPress={() => onChange({ habitSoundId: '' })}
                  compact
                >
                  None
                </Chip>
                {soundOptions.map((sound) => (
                  <Chip
                    key={sound.id}
                    selected={state.habitSoundId === sound.id}
                    onPress={() => onChange({ habitSoundId: sound.id })}
                    icon="music-note"
                    compact
                  >
                    {sound.label}
                  </Chip>
                ))}
              </View>
            )}
          </View>
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
        title="Daily tab grouping"
        description="Which section this habit appears under on the Daily tab."
      >
        <SegmentedButtons
          value={state.timeSlot}
          onValueChange={(value) => {
            if (value) onChange({ timeSlot: value as HabitTimeSlot });
          }}
          buttons={[
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
          ]}
          style={styles.field}
        />
        <SegmentedButtons
          value={state.timeSlot}
          onValueChange={(value) => {
            if (value) onChange({ timeSlot: value as HabitTimeSlot });
          }}
          buttons={[
            { value: 'evening', label: 'Evening' },
            { value: 'anytime', label: 'Anytime' },
          ]}
        />
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection title="Repeat">
        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            if (value) setScheduleType(value as HabitScheduleType);
          }}
          buttons={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Weekdays' },
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
            <TextInput
              label="Every N days"
              placeholder="2"
              value={state.scheduleInterval}
              onChangeText={(scheduleInterval) => onChange({ scheduleInterval })}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label="Anchor date"
              placeholder="YYYY-MM-DD"
              value={state.scheduleAnchorDate}
              onChangeText={(scheduleAnchorDate) => onChange({ scheduleAnchorDate })}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
            />
          </View>
        ) : null}
      </FormSection>

      <Divider style={styles.divider} />

      <FormSection
        title="Time window"
        description="Optional. Limit when the habit shows on the Daily tab."
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
                  Hidden outside this time on Daily
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
