import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ATTENTION_LIST_LIMIT, ATTENTION_WITHIN_DAYS } from '../calendar/attention';
import { formatDayHeading, formatOccurrenceTime } from '../calendar/format';
import { toDateString } from '../calendar/dates';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { useCalendarStore } from '../store/calendarStore';
import { space } from '../theme/spacing';
import HeaderPeekSheet from './HeaderPeekSheet';
import QuietText from './QuietText';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * What the calendar glyph in the day header opens.
 *
 * Attention list only — a cleared occurrence drops off rather than being
 * ticked, so silence means nothing needs you. Full history stays on the
 * Calendar screen, one tap away through the heading.
 */
export default function CalendarPeekSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
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

  const openFullCalendar = () => {
    onClose();
    // Defer so the sheet can dismiss before the stack push.
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

  const openEvent = (eventId: string) => {
    onClose();
    setTimeout(() => navigation.navigate('CalendarEventEditor', { eventId }), 0);
  };

  const isEmpty = upcoming.length === 0;
  let lastDay = '';

  return (
    <HeaderPeekSheet
      visible={visible}
      onDismiss={onClose}
      title={t('calendarPeek.title')}
      onTitlePress={openFullCalendar}
      titleA11yLabel={t('calendarPeek.openFullCalendar')}
      subtitle={
        isEmpty ? t('calendarPeek.emptySubtitle') : t('calendarPeek.withListSubtitle')
      }
      footer={
        <>
          {!isEmpty ? (
            <Button mode="text" compact onPress={openFullCalendar} icon="calendar-month">
              {t('calendarPeek.fullCalendar')}
            </Button>
          ) : (
            <View />
          )}
          <View style={styles.footerRight}>
            <Button mode="text" compact onPress={openAddEvent} icon="plus">
              {t('calendarPeek.add')}
            </Button>
            <Button mode="text" compact onPress={onClose}>
              {t('calendarPeek.close')}
            </Button>
          </View>
        </>
      }
    >
      {isEmpty ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={40}
            color={theme.colors.outline}
            style={styles.emptyGlyph}
          />
          <QuietText variant="bodyMedium" style={styles.emptyBody}>
            {t('calendarPeek.emptyBody')}
          </QuietText>
          <Button
            mode="contained-tonal"
            icon="calendar-month"
            onPress={openFullCalendar}
            style={{ borderRadius: deco.buttonRadius }}
            buttonColor={isCartoon ? theme.colors.secondaryContainer : undefined}
          >
            {t('calendarPeek.openCalendar')}
          </Button>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
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
                    style={[styles.dayHeading, { color: accent }]}
                  >
                    {formatDayHeading(occ.start)}
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={() =>
                      void clearOccurrence(occ).catch((error) => {
                        Alert.alert(
                          t('calendarPeek.couldNotMarkDoneTitle'),
                          error instanceof Error
                            ? error.message
                            : tCommon('errors.somethingWentWrong'),
                        );
                      })
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendarPeek.markDoneA11y')}
                    style={styles.checkHit}
                  >
                    <MaterialCommunityIcons
                      name="checkbox-blank-circle-outline"
                      size={26}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => openEvent(occ.eventId)}
                    style={styles.rowBody}
                  >
                    <View
                      style={[styles.dot, { backgroundColor: occ.color }]}
                      pointerEvents="none"
                    />
                    <View style={styles.rowText}>
                      <Text
                        variant="bodyMedium"
                        style={[styles.rowTitle, { color: theme.colors.onSurface }]}
                      >
                        {occ.title}
                      </Text>
                      <QuietText variant="bodySmall">
                        {formatOccurrenceTime(occ)}
                      </QuietText>
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </HeaderPeekSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.lg,
    gap: space.md,
  },
  emptyGlyph: {
    marginBottom: space.xs,
  },
  emptyBody: {
    textAlign: 'center',
  },
  dayHeading: {
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    minHeight: 44,
  },
  checkHit: {
    padding: space.xs,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '600',
  },
  dot: {
    width: 10,
    height: 10,
    // Geometric: half the size is what makes it a dot.
    borderRadius: 5,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
