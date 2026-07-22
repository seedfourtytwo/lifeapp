import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  List,
  Menu,
  Switch,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  REPEAT_OPTIONS,
  YEARLY_EXTRA_REMINDER_MINUTES,
} from '../calendar/defaults';
import {
  defaultTimedEnd,
  parseDateOnlyLocal,
  startOfLocalDay,
  toDateString,
} from '../calendar/dates';
import { parseRrule, recurrenceLabel } from '../calendar/rrule';
import type {
  CalendarEventType,
  CalendarReminder,
  RecurrenceFreq,
  RecurrenceRule,
} from '../calendar/types';
import type { RootStackParamList } from '../navigation/types';
import { suggestedRemindersFor, useCalendarStore } from '../store/calendarStore';
import EventRemindersSection from './calendar/EventRemindersSection';
import EventWhenFields from './calendar/EventWhenFields';
import {
  applyTime,
  parseTimeParts,
  type TimeParts,
} from './calendar/eventEditorHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'CalendarEventEditor'>;

const NO_REMINDERS: CalendarReminder[] = [];

/**
 * Create / edit a calendar event.
 * Remounted per event via navigator `getId` so `useState(initial)` stays in sync with route params.
 */
export default function CalendarEventEditorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('calendar');
  const eventId = route.params?.eventId;
  const seedDate = route.params?.seedDate;
  const events = useCalendarStore((s) => s.events);
  const reminders = useCalendarStore((s) => s.reminders);
  const createEvent = useCalendarStore((s) => s.createEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);

  const existing = useMemo(
    () => (eventId ? events.find((event) => event.id === eventId) : undefined),
    [eventId, events],
  );
  const existingReminders = useMemo(() => {
    if (!eventId) return NO_REMINDERS;
    return reminders
      .filter((reminder) => reminder.eventId === eventId)
      .sort((a, b) => b.offsetMinutes - a.offsetMinutes);
  }, [eventId, reminders]);

  const initial = useMemo(() => {
    if (existing) {
      const rule = parseRrule(existing.rrule);
      const start = existing.allDay
        ? startOfLocalDay(parseDateOnlyLocal(existing.startAt))
        : new Date(existing.startAt);
      const end = existing.allDay
        ? startOfLocalDay(parseDateOnlyLocal(existing.endAt))
        : new Date(existing.endAt);
      return {
        title: existing.title,
        notes: existing.notes ?? '',
        eventType: existing.eventType,
        allDay: existing.allDay,
        start,
        end,
        recurrence: rule,
        reminderOffsets: existingReminders.map((r) => r.offsetMinutes),
        startTime: existing.allDay
          ? { hour: '10', minute: '00' }
          : parseTimeParts(start),
        endTime: existing.allDay ? { hour: '11', minute: '00' } : parseTimeParts(end),
      };
    }
    const day = seedDate ? parseDateOnlyLocal(seedDate) : startOfLocalDay(new Date());
    return {
      title: '',
      notes: '',
      eventType: 'general' as CalendarEventType,
      allDay: true,
      start: day,
      end: day,
      recurrence: { freq: 'none' as RecurrenceFreq, interval: 1, byWeekDays: [] },
      reminderOffsets: suggestedRemindersFor(true),
      startTime: { hour: '10', minute: '00' },
      endTime: { hour: '11', minute: '00' },
    };
  }, [existing, existingReminders, seedDate]);

  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  /** Kept for schema/backup compat; not shown in the create UI. */
  const [eventType] = useState<CalendarEventType>(initial.eventType);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [startDate, setStartDate] = useState(toDateString(initial.start));
  const [endDate, setEndDate] = useState(toDateString(initial.end));
  const [startTime, setStartTime] = useState<TimeParts>(initial.startTime);
  const [endTime, setEndTime] = useState<TimeParts>(initial.endTime);
  const [freq, setFreq] = useState<RecurrenceFreq>(initial.recurrence.freq);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(initial.reminderOffsets);
  const [saving, setSaving] = useState(false);
  const [repeatMenuOpen, setRepeatMenuOpen] = useState(false);
  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [editingWhen, setEditingWhen] = useState<'start' | 'end' | null>(null);

  const onAllDayChange = (next: boolean) => {
    setAllDay(next);
    setReminderOffsets(suggestedRemindersFor(next));
    if (next) {
      setEndDate(startDate);
    } else {
      const start = applyTime(parseDateOnlyLocal(startDate), startTime.hour, startTime.minute);
      const end = defaultTimedEnd(start);
      setStartTime(parseTimeParts(start));
      setEndTime(parseTimeParts(end));
      setEndDate(toDateString(end));
    }
  };

  const setRepeat = (next: RecurrenceFreq) => {
    setFreq(next);
    setRepeatMenuOpen(false);
    if (next === 'yearly') {
      setReminderOffsets((prev) => {
        if (prev.includes(YEARLY_EXTRA_REMINDER_MINUTES)) return prev;
        return [...prev, YEARLY_EXTRA_REMINDER_MINUTES].sort((a, b) => b - a);
      });
    }
  };

  const onStartDateChange = (next: string) => {
    setStartDate(next);
    if (allDay || endDate < next) setEndDate(next);
  };

  const buildDates = (): { start: Date; end: Date } | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      Alert.alert(t('editor.invalidDateTitle'), t('editor.invalidDateBody'));
      return null;
    }
    if (allDay) {
      const start = startOfLocalDay(parseDateOnlyLocal(startDate));
      const end = startOfLocalDay(parseDateOnlyLocal(endDate));
      if (end < start) {
        Alert.alert(t('editor.invalidRangeTitle'), t('editor.invalidRangeBody'));
        return null;
      }
      return { start, end };
    }
    const start = applyTime(parseDateOnlyLocal(startDate), startTime.hour, startTime.minute);
    const end = applyTime(parseDateOnlyLocal(endDate), endTime.hour, endTime.minute);
    if (end.getTime() <= start.getTime()) {
      Alert.alert(t('editor.invalidTimeTitle'), t('editor.invalidTimeBody'));
      return null;
    }
    return { start, end };
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert(t('editor.titleRequiredTitle'), t('editor.titleRequiredBody'));
      return;
    }
    const dates = buildDates();
    if (!dates) return;

    const recurrence: RecurrenceRule = (() => {
      const previous = existing ? parseRrule(existing.rrule) : null;
      if (previous && previous.freq === freq) {
        return {
          freq,
          interval: previous.interval,
          byWeekDays: freq === 'weekly' ? previous.byWeekDays : [],
        };
      }
      return { freq, interval: 1, byWeekDays: [] };
    })();

    setSaving(true);
    try {
      const payload = {
        title: trimmed,
        notes,
        eventType,
        allDay,
        start: dates.start,
        end: dates.end,
        recurrence,
        reminderOffsets,
      };
      if (eventId) await updateEvent(eventId, payload);
      else await createEvent(payload);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t('editor.couldNotSaveTitle'),
        error instanceof Error ? error.message : t('common:errors.unknownError'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!eventId) return;
    Alert.alert(t('editor.deleteConfirmTitle'), t('editor.deleteConfirmBody'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('common:actions.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteEvent(eventId)
            .then(() => navigation.goBack())
            .catch((error) => {
              Alert.alert(
                t('editor.couldNotDeleteTitle'),
                error instanceof Error ? error.message : t('common:errors.unknownError'),
              );
            });
        },
      },
    ]);
  };

  const repeatLabel =
    REPEAT_OPTIONS.find((o) => o.freq === freq) != null
      ? t(REPEAT_OPTIONS.find((o) => o.freq === freq)!.labelKey)
      : recurrenceLabel({ freq, interval: 1, byWeekDays: [] });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        placeholder={t('editor.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        mode="flat"
        style={[styles.titleInput, { backgroundColor: 'transparent' }]}
        contentStyle={{ fontSize: 22 }}
        autoFocus={!eventId}
      />

      <Divider style={styles.divider} />

      <List.Item
        title={t('editor.allDay')}
        left={(props) => <List.Icon {...props} icon="calendar-blank" />}
        right={() => <Switch value={allDay} onValueChange={onAllDayChange} />}
      />

      <EventWhenFields
        allDay={allDay}
        startDate={startDate}
        endDate={endDate}
        startTime={startTime}
        endTime={endTime}
        editingWhen={editingWhen}
        onToggleEditing={(which) => setEditingWhen(editingWhen === which ? null : which)}
        onStartDateChange={onStartDateChange}
        onEndDateChange={setEndDate}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />

      <Divider style={styles.divider} />

      <Menu
        visible={repeatMenuOpen}
        onDismiss={() => setRepeatMenuOpen(false)}
        anchor={
          <List.Item
            title={t('editor.repeat')}
            description={repeatLabel}
            left={(props) => <List.Icon {...props} icon="repeat" />}
            right={(props) => <List.Icon {...props} icon="chevron-down" />}
            onPress={() => setRepeatMenuOpen(true)}
          />
        }
      >
        {REPEAT_OPTIONS.map((option) => (
          <Menu.Item
            key={option.freq}
            onPress={() => setRepeat(option.freq)}
            title={t(option.labelKey)}
            leadingIcon={freq === option.freq ? 'check' : undefined}
          />
        ))}
      </Menu>

      <Divider style={styles.divider} />

      <EventRemindersSection
        reminderOffsets={reminderOffsets}
        addReminderOpen={addReminderOpen}
        onOpenAdd={() => setAddReminderOpen(true)}
        onCloseAdd={() => setAddReminderOpen(false)}
        onAdd={(offset) => {
          setReminderOffsets((prev) =>
            prev.includes(offset) ? prev : [...prev, offset].sort((a, b) => b - a),
          );
          setAddReminderOpen(false);
        }}
        onRemove={(offset) => setReminderOffsets((prev) => prev.filter((o) => o !== offset))}
      />

      <Divider style={styles.divider} />

      <TextInput
        label={t('editor.notesLabel')}
        value={notes}
        onChangeText={setNotes}
        mode="outlined"
        multiline
        style={styles.notes}
      />

      <View style={styles.actions}>
        <Button mode="contained" onPress={() => void handleSave()} loading={saving} disabled={saving}>
          {t('editor.save')}
        </Button>
        {eventId ? (
          <Button mode="text" textColor={theme.colors.error} onPress={handleDelete}>
            {t('editor.deleteEvent')}
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  titleInput: {
    marginHorizontal: 8,
    marginTop: 4,
  },
  divider: {
    marginVertical: 4,
  },
  notes: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actions: {
    paddingHorizontal: 16,
    gap: 8,
  },
});
