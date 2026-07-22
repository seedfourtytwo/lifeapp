import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { List, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { parseDateOnlyLocal } from '../../calendar/dates';
import { formatTime } from '../../calendar/format';
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

/** Inline start/end date (and optional time) fields for the event editor. */
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
  const theme = useTheme();
  const { t } = useTranslation('calendar');

  const startSummary = allDay
    ? formatFriendlyDate(startDate)
    : `${formatFriendlyDate(startDate)} · ${formatTime(applyTime(parseDateOnlyLocal(startDate), startTime.hour, startTime.minute))}`;
  const endSummary = allDay
    ? formatFriendlyDate(endDate)
    : `${formatFriendlyDate(endDate)} · ${formatTime(applyTime(parseDateOnlyLocal(endDate), endTime.hour, endTime.minute))}`;

  return (
    <>
      <List.Item
        title={t('editor.starts')}
        description={startSummary}
        left={(props) => <List.Icon {...props} icon="clock-start" />}
        onPress={() => onToggleEditing('start')}
      />
      {editingWhen === 'start' ? (
        <View style={styles.inlineEditor}>
          <View style={styles.dateShiftRow}>
            <Pressable
              onPress={() => {
                const next = shiftDateString(startDate, -1);
                onStartDateChange(next);
              }}
              style={styles.chip}
            >
              <Text style={{ color: theme.colors.primary }}>{t('editor.minusOneDay')}</Text>
            </Pressable>
            <TextInput
              label={t('editor.dateLabel')}
              value={startDate}
              onChangeText={onStartDateChange}
              mode="outlined"
              dense
              style={styles.flex}
              placeholder="YYYY-MM-DD"
            />
            <Pressable
              onPress={() => {
                const next = shiftDateString(startDate, 1);
                onStartDateChange(next);
              }}
              style={styles.chip}
            >
              <Text style={{ color: theme.colors.primary }}>{t('editor.plusOneDay')}</Text>
            </Pressable>
          </View>
          {!allDay ? (
            <View style={styles.timeRow}>
              <TextInput
                label={t('editor.hourLabel')}
                value={startTime.hour}
                onChangeText={(hour) => onStartTimeChange({ ...startTime, hour })}
                mode="outlined"
                dense
                keyboardType="number-pad"
                style={styles.flex}
              />
              <TextInput
                label={t('editor.minuteLabel')}
                value={startTime.minute}
                onChangeText={(minute) => onStartTimeChange({ ...startTime, minute })}
                mode="outlined"
                dense
                keyboardType="number-pad"
                style={styles.flex}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <List.Item
        title={t('editor.ends')}
        description={endSummary}
        left={(props) => <List.Icon {...props} icon="clock-end" />}
        onPress={() => onToggleEditing('end')}
      />
      {editingWhen === 'end' ? (
        <View style={styles.inlineEditor}>
          <TextInput
            label={t('editor.dateLabel')}
            value={endDate}
            onChangeText={onEndDateChange}
            mode="outlined"
            dense
            placeholder="YYYY-MM-DD"
          />
          {!allDay ? (
            <View style={styles.timeRow}>
              <TextInput
                label={t('editor.hourLabel')}
                value={endTime.hour}
                onChangeText={(hour) => onEndTimeChange({ ...endTime, hour })}
                mode="outlined"
                dense
                keyboardType="number-pad"
                style={styles.flex}
              />
              <TextInput
                label={t('editor.minuteLabel')}
                value={endTime.minute}
                onChangeText={(minute) => onEndTimeChange({ ...endTime, minute })}
                mode="outlined"
                dense
                keyboardType="number-pad"
                style={styles.flex}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  inlineEditor: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  dateShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: { flex: 1 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
});
