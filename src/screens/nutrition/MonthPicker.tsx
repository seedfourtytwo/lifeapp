import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { getDateLocale } from '../../i18n';

type Props = {
  selected: readonly number[];
  /** Months that may be picked; omit to allow all twelve. */
  allowed?: readonly number[];
  onToggle: (month: number) => void;
  label: string;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Day 15 of an arbitrary year — avoids month-length rollover when formatting. */
function monthDate(month: number): Date {
  return new Date(2026, month - 1, 15);
}

/** Twelve toggles — the whole year visible at once, no scrolling. */
export default function MonthPicker({ selected, allowed, onToggle, label }: Props) {
  const theme = useTheme();
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allowedSet = useMemo(() => (allowed ? new Set(allowed) : null), [allowed]);
  // Twelve Intl formats per render otherwise, on every keystroke elsewhere.
  const names = useMemo(() => {
    const locale = getDateLocale();
    return MONTHS.map((month) => ({
      narrow: monthDate(month).toLocaleDateString(locale, { month: 'narrow' }),
      long: monthDate(month).toLocaleDateString(locale, { month: 'long' }),
    }));
  }, []);

  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      {MONTHS.map((month) => {
        const isSelected = selectedSet.has(month);
        const disabled = allowedSet != null && !allowedSet.has(month);
        return (
          <Pressable
            key={month}
            onPress={() => onToggle(month)}
            disabled={disabled}
            style={[
              styles.month,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant,
                opacity: disabled ? 0.35 : 1,
              },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled }}
            accessibilityLabel={names[month - 1]?.long}
          >
            <Text
              variant="labelSmall"
              style={{
                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
              }}
            >
              {names[month - 1]?.narrow}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
  },
  month: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
});
