import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '../../i18n';
import { formatFullDate } from '../../utils/dates';

type Props = {
  dates: readonly string[];
  selectedDate: string;
  today: string;
  /** Dates with at least one food logged — shown with a dot. */
  loggedDates: ReadonlySet<string>;
  onSelect: (date: string) => void;
};

function weekdayInitial(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(getDateLocale(), { weekday: 'narrow' });
}

function dayOfMonth(dateStr: string): string {
  return String(new Date(`${dateStr}T12:00:00`).getDate());
}

/** Mon–Sun selector: which day of this week you are logging into. */
export default function WeekDayStrip({
  dates,
  selectedDate,
  today,
  loggedDates,
  onSelect,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');

  return (
    <View style={styles.row}>
      {dates.map((date) => {
        const selected = date === selectedDate;
        const isToday = date === today;
        const isFuture = date > today;
        const color = selected
          ? theme.colors.onPrimary
          : isFuture
            ? theme.colors.onSurfaceDisabled
            : theme.colors.onSurface;

        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            disabled={isFuture}
            style={[
              styles.day,
              selected && { backgroundColor: theme.colors.primary },
              !selected && isToday && { borderColor: theme.colors.primary, borderWidth: 1 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: isFuture }}
            accessibilityLabel={t('day.a11ySelect', { date: formatFullDate(date) })}
          >
            <Text variant="labelSmall" style={{ color }}>
              {weekdayInitial(date)}
            </Text>
            <Text variant="labelLarge" style={{ color }}>
              {dayOfMonth(date)}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: loggedDates.has(date)
                    ? selected
                      ? theme.colors.onPrimary
                      : theme.colors.primary
                    : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 12,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 1,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
