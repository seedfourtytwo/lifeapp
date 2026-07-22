import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ATTENTION_LIST_LIMIT, ATTENTION_WITHIN_DAYS } from '../calendar/attention';
import { formatDayHeading, formatOccurrenceTime } from '../calendar/format';
import { toDateString } from '../calendar/dates';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { useCalendarStore } from '../store/calendarStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Attention list only — cleared occurrences drop off (silence). Full history stays on Calendar. */
export default function CalendarPeekSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { decorations: deco, isCartoon } = useAppTheme();
  const accent = isCartoon ? theme.colors.secondary : theme.colors.primary;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const events = useCalendarStore((s) => s.events);
  const calendars = useCalendarStore((s) => s.calendars);
  const clearedByKey = useCalendarStore((s) => s.clearedByKey);
  const clearOccurrence = useCalendarStore((s) => s.clearOccurrence);
  const attentionOccurrences = useCalendarStore((s) => s.attentionOccurrences);

  const upcoming = useMemo(() => {
    if (!visible) return [];
    // Subscribe to slices above; method identity is stable across store updates.
    void events;
    void calendars;
    void clearedByKey;
    return attentionOccurrences(ATTENTION_LIST_LIMIT, ATTENTION_WITHIN_DAYS);
  }, [attentionOccurrences, calendars, clearedByKey, events, visible]);

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
  const isEmpty = upcoming.length === 0;

  return (
    <View
      style={[
        styles.sheet,
        !isEmpty && styles.sheetWithList,
        {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: deco.radius.lg,
          borderTopRightRadius: deco.radius.lg,
          paddingBottom: 20 + insets.bottom,
          ...(isCartoon && {
            borderTopWidth: deco.headerBorderWidth,
            borderColor: theme.colors.outline,
          }),
        },
      ]}
    >
      <Pressable
        onPress={openFullCalendar}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Open full calendar"
      >
        <Text
          variant="titleMedium"
          style={isCartoon ? { color: theme.colors.onSurface, fontWeight: '700' } : undefined}
        >
          Calendar
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
      </Pressable>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
      >
        {isEmpty
          ? 'No upcoming events in the next two weeks.'
          : 'Upcoming · tap ✓ to silence this occurrence'}
      </Text>

      {isEmpty ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={40}
            color={theme.colors.onSurfaceVariant}
            style={{ marginBottom: 12, opacity: 0.6 }}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16, textAlign: 'center' }}
          >
            Nothing needing attention right now.
          </Text>
          <Button
            mode="contained-tonal"
            icon="calendar-month"
            onPress={openFullCalendar}
            style={{ borderRadius: deco.buttonRadius }}
            buttonColor={isCartoon ? theme.colors.secondaryContainer : undefined}
          >
            Open calendar
          </Button>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {upcoming.map((occ) => {
            const dayKey = toDateString(occ.start);
            const showHeading = dayKey !== lastDay;
            lastDay = dayKey;
            return (
              <View key={occ.occurrenceKey}>
                {showHeading ? (
                  <Text
                    variant="labelLarge"
                    style={{ marginTop: 8, marginBottom: 4, color: accent }}
                  >
                    {formatDayHeading(occ.start)}
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={() =>
                      void clearOccurrence(occ).catch((error) => {
                        Alert.alert(
                          'Could not mark done',
                          error instanceof Error ? error.message : 'Something went wrong',
                        );
                      })
                    }
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
          })}
        </ScrollView>
      )}

      <View style={[styles.actions, isEmpty && styles.actionsEmpty]}>
        {!isEmpty ? (
          <Button mode="text" compact onPress={openFullCalendar} icon="calendar-month">
            Full calendar
          </Button>
        ) : null}
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
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetWithList: {
    maxHeight: '70%',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
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
  actionsEmpty: {
    justifyContent: 'flex-end',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
