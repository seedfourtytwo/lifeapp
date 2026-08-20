import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatShortDate } from '../../utils/dates';
import {
  APP_DAY_RESET_TIME_LABEL,
  currentAppCalendarDate,
} from '../../utils/dayRollover';

type Props = {
  /** Calendar "now" from `useAppCalendarNow` — advances on day rollover. */
  now: Date;
};

/** Leading meta-row status shared by Habits and Counters: today's date · daily reset time. */
export default function HomeTabDayStatus({ now }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { isCartoon } = useAppTheme();
  const date = formatShortDate(currentAppCalendarDate(now));
  const color = isCartoon ? theme.colors.onSecondaryContainer : theme.colors.onSurface;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t('dayStatus.a11y', {
        date,
        time: APP_DAY_RESET_TIME_LABEL,
      })}
    >
      <Text
        variant="bodyMedium"
        numberOfLines={1}
        style={[styles.date, { color }, isCartoon && styles.cartoonDate]}
      >
        {date}
      </Text>
      <MaterialCommunityIcons
        name="refresh"
        size={15}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        variant="bodySmall"
        numberOfLines={1}
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {APP_DAY_RESET_TIME_LABEL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  date: {
    flexShrink: 1,
    marginRight: 2,
  },
  cartoonDate: {
    fontWeight: '600',
  },
});
