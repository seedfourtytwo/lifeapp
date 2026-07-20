import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, FAB, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addLocalDays, monthGridRange, startOfLocalDay, toDateString } from '../calendar/dates';
import { formatDayHeading, formatOccurrenceTime, formatMonthTitle } from '../calendar/format';
import { occurrencesOnDay } from '../calendar/occurrences';
import type { RootStackParamList } from '../navigation/types';
import { useCalendarStore } from '../store/calendarStore';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const events = useCalendarStore((s) => s.events);
  const calendars = useCalendarStore((s) => s.calendars);
  const clearedByKey = useCalendarStore((s) => s.clearedByKey);
  const clearOccurrence = useCalendarStore((s) => s.clearOccurrence);
  const unclearedOccurrence = useCalendarStore((s) => s.unclearedOccurrence);

  const today = startOfLocalDay(new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const { start: gridStart, end: gridEnd } = useMemo(
    () => monthGridRange(year, monthIndex),
    [monthIndex, year],
  );

  const monthOccurrences = useMemo(() => {
    void calendars;
    void events;
    return useCalendarStore.getState().occurrencesInRange(gridStart, gridEnd);
  }, [calendars, events, gridEnd, gridStart]);

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const occ of monthOccurrences) {
      let d = startOfLocalDay(occ.start);
      const last = startOfLocalDay(addLocalDays(occ.end, -1));
      while (d.getTime() <= last.getTime()) {
        set.add(toDateString(d));
        d = addLocalDays(d, 1);
      }
    }
    return set;
  }, [monthOccurrences]);

  const dayOccurrences = useMemo(
    () => occurrencesOnDay(monthOccurrences, selectedDay),
    [monthOccurrences, selectedDay],
  );

  const cells: Date[] = [];
  for (let d = new Date(gridStart); d.getTime() < gridEnd.getTime(); d = addLocalDays(d, 1)) {
    cells.push(new Date(d));
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 88 + insets.bottom }}>
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setCursor(new Date(year, monthIndex - 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.monthNav}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.primary} />
          </Pressable>
          <Text variant="titleMedium">{formatMonthTitle(year, monthIndex)}</Text>
          <Pressable
            onPress={() => setCursor(new Date(year, monthIndex + 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.monthNav}
          >
            <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_LABELS.map((label) => (
            <Text
              key={label}
              variant="labelSmall"
              style={[styles.weekLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day) => {
            const key = toDateString(day);
            const inMonth = day.getMonth() === monthIndex;
            const selected = key === toDateString(selectedDay);
            const isToday = key === toDateString(today);
            const hasEvents = daysWithEvents.has(key);
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.dayCell,
                  selected && { backgroundColor: theme.colors.primaryContainer },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${key}${hasEvents ? ', has events' : ''}`}
              >
                <Text
                  variant="bodyMedium"
                  style={{
                    color: !inMonth
                      ? theme.colors.outline
                      : selected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurface,
                    fontWeight: isToday || selected ? '700' : '400',
                  }}
                >
                  {day.getDate()}
                </Text>
                {hasEvents ? (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: selected
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.primary,
                      },
                    ]}
                  />
                ) : (
                  <View style={styles.dotSpacer} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.daySection}>
          <Text variant="titleSmall" style={{ marginBottom: 8 }}>
            {formatDayHeading(selectedDay)}
          </Text>
          {dayOccurrences.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              No events
            </Text>
          ) : (
            dayOccurrences.map((occ) => {
              const cleared = clearedByKey[occ.occurrenceKey] != null;
              return (
                <View
                  key={occ.occurrenceKey}
                  style={[
                    styles.eventRow,
                    { borderColor: theme.colors.outlineVariant, opacity: cleared ? 0.5 : 1 },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      if (cleared) void unclearedOccurrence(occ.occurrenceKey);
                      else void clearOccurrence(occ);
                    }}
                    hitSlop={6}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: cleared }}
                    accessibilityLabel={
                      cleared ? 'Undo done for this occurrence' : 'Mark done for this occurrence'
                    }
                    style={styles.checkHit}
                  >
                    <MaterialCommunityIcons
                      name={cleared ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={26}
                      color={cleared ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('CalendarEventEditor', { eventId: occ.eventId })
                    }
                    style={styles.eventPress}
                  >
                    <View style={[styles.colorBar, { backgroundColor: occ.color }]} />
                    <View style={styles.eventBody}>
                      <Text
                        variant="bodyLarge"
                        style={{
                          fontWeight: '600',
                          textDecorationLine: cleared ? 'line-through' : 'none',
                        }}
                      >
                        {occ.title}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {cleared ? 'Done · ' : ''}
                        {formatOccurrenceTime(occ)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
          <Button
            mode="text"
            icon="plus"
            onPress={() =>
              navigation.navigate('CalendarEventEditor', {
                seedDate: toDateString(selectedDay),
              })
            }
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Add event
          </Button>
        </View>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: 16 + insets.bottom, backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() =>
          navigation.navigate('CalendarEventEditor', {
            seedDate: toDateString(selectedDay),
          })
        }
        accessibilityLabel="Add event"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  monthNav: { padding: 8 },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  dotSpacer: {
    height: 8,
  },
  daySection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 8,
    gap: 4,
  },
  checkHit: {
    padding: 6,
  },
  eventPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  eventBody: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 16,
  },
});
