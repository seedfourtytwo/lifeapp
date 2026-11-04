import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { parseDateOnlyLocal } from '../../calendar/dates';
import { formatTime } from '../../calendar/format';
import Rule from '../../components/Rule';
import { SettingsRow, settingsRowStyles } from '../../components/settings';
import { FilledField } from '../../components/sheet';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import {
  applyTime,
  formatFriendlyDate,
  shiftDateString,
  type TimeParts,
} from './eventEditorHelpers';

interface Props {
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: TimeParts;
  endTime: TimeParts;
  editingWhen: 'start' | 'end' | null;
  onToggleEditing: (which: 'start' | 'end') => void;
  onStartDateChange: (next: string) => void;
  onEndDateChange: (next: string) => void;
  onStartTimeChange: (next: TimeParts) => void;
  onEndTimeChange: (next: TimeParts) => void;
}

/** A small pill that nudges the date by a day: the common edit, one tap. */
function DayNudge({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.nudge,
        {
          backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.background,
          borderRadius: deco.radius.pill,
        },
      ]}
    >
      <Text style={[typeScale.secondary, styles.nudgeLabel, { color: theme.colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Start and end rows for the event editor. Tapping one opens its date (and
 * time) fields right under it, so the common case — a whole-day event today —
 * never shows a field at all.
 */
export default function EventWhenFields({
  allDay,
  startDate,
  endDate,
  startTime,
  endTime,
  editingWhen,
  onToggleEditing,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: Props) {
  const { t } = useTranslation('calendar');

  const startSummary = allDay
    ? formatFriendlyDate(startDate)
    : `${formatFriendlyDate(startDate)} · ${formatTime(applyTime(parseDateOnlyLocal(startDate), startTime.hour, startTime.minute))}`;
  const endSummary = allDay
    ? formatFriendlyDate(endDate)
    : `${formatFriendlyDate(endDate)} · ${formatTime(applyTime(parseDateOnlyLocal(endDate), endTime.hour, endTime.minute))}`;

  const timeFields = (time: TimeParts, onChange: (next: TimeParts) => void) =>
    allDay ? null : (
      <View style={styles.timeRow}>
        <FilledField
          label={t('editor.hourLabel')}
          value={time.hour}
          onChangeText={(hour) => onChange({ ...time, hour })}
          keyboardType="number-pad"
          style={styles.flex}
        />
        <FilledField
          label={t('editor.minuteLabel')}
          value={time.minute}
          onChangeText={(minute) => onChange({ ...time, minute })}
          keyboardType="number-pad"
          style={styles.flex}
        />
      </View>
    );

  return (
    <View>
      <SettingsRow
        icon="clock-start"
        title={t('editor.starts')}
        description={startSummary}
        onPress={() => onToggleEditing('start')}
      />
      {editingWhen === 'start' ? (
        <View style={styles.inlineEditor}>
          <View style={styles.dateShiftRow}>
            <DayNudge
              label={t('editor.minusOneDay')}
              onPress={() => onStartDateChange(shiftDateString(startDate, -1))}
            />
            <FilledField
              label={t('editor.dateLabel')}
              value={startDate}
              onChangeText={onStartDateChange}
              placeholder="YYYY-MM-DD"
              style={styles.flex}
            />
            <DayNudge
              label={t('editor.plusOneDay')}
              onPress={() => onStartDateChange(shiftDateString(startDate, 1))}
            />
          </View>
          {timeFields(startTime, onStartTimeChange)}
        </View>
      ) : null}

      <Rule style={styles.rule} />

      <SettingsRow
        icon="clock-end"
        title={t('editor.ends')}
        description={endSummary}
        onPress={() => onToggleEditing('end')}
      />
      {editingWhen === 'end' ? (
        <View style={styles.inlineEditor}>
          <FilledField
            label={t('editor.dateLabel')}
            value={endDate}
            onChangeText={onEndDateChange}
            placeholder="YYYY-MM-DD"
          />
          {timeFields(endTime, onEndTimeChange)}
        </View>
      ) : null}
    </View>
  );
}

/** Where a row's title starts, so the fields and rules line up under it. */
const TEXT_INSET = space.lg + settingsRowStyles.iconSlot.width + space.lg;

const styles = StyleSheet.create({
  inlineEditor: {
    paddingLeft: TEXT_INSET,
    paddingRight: space.lg,
    paddingBottom: space.lg,
    gap: space.md,
  },
  dateShiftRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  flex: { flex: 1 },
  nudge: {
    minHeight: 56,
    minWidth: 48,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeLabel: {
    fontWeight: '500',
  },
  rule: {
    marginLeft: TEXT_INSET,
  },
});
