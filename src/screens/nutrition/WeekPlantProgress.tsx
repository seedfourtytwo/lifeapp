import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { WeekDiversity } from '../../nutrition/weekDiversity';

type Props = {
  diversity: WeekDiversity;
};

/** Headline for the Mon–Sun week: distinct plants against the target. */
export default function WeekPlantProgress({ diversity }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');
  const met = diversity.remaining === 0;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
      accessible
      accessibilityLabel={t('week.a11yProgress', {
        count: diversity.plantCount,
        target: diversity.target,
      })}
    >
      <View style={styles.headingRow}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('week.plantsHeading')}
        </Text>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
          {t('week.count', { count: diversity.plantCount, target: diversity.target })}
        </Text>
      </View>

      <ProgressBar
        progress={diversity.progress}
        color={met ? theme.colors.primary : theme.colors.secondary}
        style={styles.bar}
      />

      <View style={styles.footerRow}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {met
            ? t('week.targetMet')
            : t('week.remaining', {
                count: diversity.remaining,
                target: diversity.target,
              })}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('week.totalFoods', { count: diversity.totalCount })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
