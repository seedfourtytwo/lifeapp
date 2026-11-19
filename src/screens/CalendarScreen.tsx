import React, { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { addLocalDays, monthGridRange, startOfLocalDay, toDateString } from '../calendar/dates';
import EmptyState from '../components/EmptyState';
import QuietText from '../components/QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { formatDayHeading, formatOccurrenceTime, formatMonthTitle } from '../calendar/format';
import { occurrencesOnDay } from '../calendar/occurrences';
import type { RootStackParamList } from '../navigation/types';
import { useCalendarStore } from '../store/calendarStore';
import PageHeader from './shared/PageHeader';
import { notify } from '../components/sheet/confirm';

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * The Calendar page of the Home pager. Everything it shows comes from the
 * calendar store, which is loaded at startup, so it has nothing to fetch when
 * it is built. Adding and editing still push the event editor on the stack.
 */
function CalendarScreen() {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { t } = useTranslation(['calendar', 'common', 'home']);
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

  const addEvent = () =>
    navigation.navigate('CalendarEventEditor', { seedDate: toDateString(selectedDay) });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.pageHeader}>
        <PageHeader
          title={t('home:dock.calendar')}
          actions={
            <IconButton
              icon="plus"
              size={24}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={addEvent}
              accessibilityLabel={t('calendar:screen.addEvent')}
              style={styles.addButton}
            />
          }
        />
      </View>

      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => setCursor(new Date(year, monthIndex - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar:screen.previousMonth')}
          style={styles.monthNav}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
        <Text
          style={[typeScale.rowName, { color: theme.colors.onSurface }]}
          accessibilityRole="header"
        >
          {formatMonthTitle(year, monthIndex)}
        </Text>
        <Pressable
          onPress={() => setCursor(new Date(year, monthIndex + 1, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar:screen.nextMonth')}
          style={styles.monthNav}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_ORDER.map((key) => (
          <Text
            key={key}
            style={[typeScale.caption, styles.weekLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            {t(`common:weekdaysShort.${key}`)}
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
                { borderRadius: deco.radius.md },
                selected && { backgroundColor: theme.colors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                hasEvents ? t('calendar:screen.dayHasEventsA11y', { date: key }) : key
              }
            >
              <Text
                style={[
                  typeScale.body,
                  styles.dayNumber,
                  {
                    color: selected
                      ? theme.colors.onPrimary
                      : !inMonth
                        ? theme.colors.onSurfaceVariant
                        : isToday
                          ? theme.colors.primary
                          : theme.colors.onSurface,
                    fontWeight: isToday || selected ? '600' : '400',
                  },
                ]}
              >
                {day.getDate()}
              </Text>
              {hasEvents ? (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: selected ? theme.colors.onPrimary : theme.colors.primary,
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
        <Text style={[styles.dayHeading, { color: theme.colors.onSurfaceVariant }]}>
          {formatDayHeading(selectedDay)}
        </Text>
        {dayOccurrences.length === 0 ? (
          <EmptyState
            message={t('calendar:screen.noEvents')}
            actionLabel={t('calendar:screen.addEvent')}
            onAction={addEvent}
          />
        ) : (
          dayOccurrences.map((occ) => {
            const cleared = clearedByKey[occ.occurrenceKey] != null;
            return (
              <View
                key={occ.occurrenceKey}
                style={[
                  styles.eventRow,
                  { borderRadius: deco.radius.lg, backgroundColor: theme.colors.surface },
                ]}
              >
                <Pressable
                  onPress={() => {
                    const action = cleared
                      ? unclearedOccurrence(occ.occurrenceKey)
                      : clearOccurrence(occ);
                    void action.catch((error) => {
                      void notify({
                        title: cleared
                          ? t('calendar:screen.couldNotRestoreTitle')
                          : t('calendar:screen.couldNotMarkDoneTitle'),
                        message: error instanceof Error
                          ? error.message
                          : t('common:errors.somethingWentWrong'),
                      });
                    });
                  }}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: cleared }}
                  accessibilityLabel={
                    cleared
                      ? t('calendar:screen.undoDoneA11y')
                      : t('calendar:screen.markDoneA11y')
                  }
                  style={styles.checkHit}
                >
                  <MaterialCommunityIcons
                    name={cleared ? 'check-circle' : 'circle-outline'}
                    size={28}
                    color={cleared ? theme.colors.primary : theme.colors.outline}
                  />
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate('CalendarEventEditor', { eventId: occ.eventId })
                  }
                  style={styles.eventPress}
                >
                  <View
                    style={[
                      styles.colorBar,
                      { backgroundColor: occ.color, borderRadius: deco.radius.pill },
                    ]}
                  />
                  <View style={styles.eventBody}>
                    <Text
                      style={[
                        typeScale.rowName,
                        {
                          color: theme.colors.onSurface,
                          textDecorationLine: cleared ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {occ.title}
                    </Text>
                    <QuietText style={typeScale.secondary}>
                      {cleared ? t('calendar:screen.doneLabel') : ''}
                      {formatOccurrenceTime(occ)}
                    </QuietText>
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
        {dayOccurrences.length > 0 ? (
          <Button
            mode="text"
            icon="plus"
            onPress={addEvent}
            style={styles.addEvent}
          >
            {t('calendar:screen.addEvent')}
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** The month's grid sits inside the gutter, less the cells' own breathing room. */
const GRID_INSET = layout.gutter - space.xs;

const styles = StyleSheet.create({
  container: {
    // The Home pages' top edge, so the title sits where the date does.
    paddingTop: space.md,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  pageHeader: {
    paddingHorizontal: layout.gutter,
  },
  /** Flush with the gutter: the glyph's own box supplies the breathing room. */
  addButton: {
    margin: 0,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_INSET,
    paddingTop: space.sm,
  },
  monthNav: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: GRID_INSET,
    marginTop: space.md,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_INSET,
    marginTop: space.xs,
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  dayNumber: {
    textAlign: 'center',
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
    paddingHorizontal: layout.gutter,
    paddingTop: layout.sectionGap,
  },
  dayHeading: {
    ...typeScale.caption,
    fontSize: 14,
    paddingHorizontal: space.xs,
    marginBottom: space.sm,
  },
  eventRow: {
    minHeight: layout.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    marginBottom: layout.rowGap,
  },
  checkHit: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingRight: space.md,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  eventBody: { flex: 1, gap: space.xxs },
  addEvent: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
});

/**
 * Memoised because it takes no props: a Home page change re-renders HomeScreen,
 * and this page has no reason to follow it.
 */
export default memo(CalendarScreen);
