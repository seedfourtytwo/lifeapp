import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDayHeading, formatOccurrenceTime } from '../calendar/format';
import { toDateString } from '../calendar/dates';
import type { RootStackParamList } from '../navigation/types';
import { useCalendarStore } from '../store/calendarStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PEEK_LIMIT = 8;
const PEEK_WITHIN_DAYS = 60;

/** Attention list only — cleared occurrences drop off (silence). Full history stays on Calendar. */
export default function CalendarPeekSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const events = useCalendarStore((s) => s.events);
  const calendars = useCalendarStore((s) => s.calendars);
  const clearedByKey = useCalendarStore((s) => s.clearedByKey);
  const clearOccurrence = useCalendarStore((s) => s.clearOccurrence);
  const attentionOccurrences = useCalendarStore((s) => s.attentionOccurrences);

  const upcoming = useMemo(() => {
    // Subscribe to slices above; method identity is stable across store updates.
    void events;
    void calendars;
    void clearedByKey;
    return attentionOccurrences(PEEK_LIMIT, PEEK_WITHIN_DAYS);
  }, [attentionOccurrences, calendars, clearedByKey, events]);

  if (!visible) return null;

  const openFullCalendar = () => {
    onClose();
    // Defer so the Home modal can dismiss before the stack push.
    setTimeout(() => navigation.navigate('Calendar'), 0);
  };

  const openAddEvent = () => {
    onClose();
    setTimeout(
      () =>
        navigation.navigate('CalendarEventEditor', {
          seedDate: toDateString(new Date()),
        }),
      0,
    );
  };

  let lastDay = '';

  return (
    <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
      <Pressable
        onPress={openFullCalendar}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Open full calendar"
      >
        <Text variant="titleMedium">Calendar</Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={theme.colors.primary}
        />
      </Pressable>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
      >
        Upcoming · tap ✓ to silence this occurrence
      </Text>

      {upcoming.length === 0 ? (
        <View style={styles.empty}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
          >
            Nothing needing attention right now.
          </Text>
          <Button mode="contained-tonal" icon="calendar-month" onPress={openFullCalendar}>
            Open calendar
          </Button>
        </View>
      ) : (
        upcoming.map((occ) => {
          const dayKey = toDateString(occ.start);
          const showHeading = dayKey !== lastDay;
          lastDay = dayKey;
          return (
            <View key={occ.occurrenceKey}>
              {showHeading ? (
                <Text
                  variant="labelLarge"
                  style={{ marginTop: 8, marginBottom: 4, color: theme.colors.primary }}
                >
                  {formatDayHeading(occ.start)}
                </Text>
              ) : null}
              <View style={styles.row}>
                <Pressable
                  onPress={() => void clearOccurrence(occ)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark done for this occurrence"
                  style={styles.checkHit}
                >
                  <MaterialCommunityIcons
                    name="checkbox-blank-circle-outline"
                    size={26}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
                <Pressable
                  onPress={() => {
                    onClose();
                    setTimeout(
                      () =>
                        navigation.navigate('CalendarEventEditor', { eventId: occ.eventId }),
                      0,
                    );
                  }}
                  style={styles.rowBody}
                >
                  <View style={[styles.dot, { backgroundColor: occ.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                      {occ.title}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatOccurrenceTime(occ)}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.actions}>
        {upcoming.length > 0 ? (
          <Button mode="text" compact onPress={openFullCalendar} icon="calendar-month">
            Full calendar
          </Button>
        ) : (
          <View />
        )}
        <View style={styles.actionRight}>
          <Button mode="text" compact onPress={openAddEvent} icon="plus">
            Add
          </Button>
          <Button mode="text" compact onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 4,
  },
  empty: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  checkHit: {
    padding: 4,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
