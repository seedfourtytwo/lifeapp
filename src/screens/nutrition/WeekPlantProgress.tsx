import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { clamp01 } from '../../utils/clamp01';
import type { WeekDiversity } from '../../nutrition/weekDiversity';

type Props = {
  diversity: WeekDiversity;
};

/** Headline for the Mon–Sun week: distinct plants against the target. */
export default function WeekPlantProgress({ diversity }: Props) {
  const theme = useTheme();
  const { decorations: deco, palette } = useAppTheme();
  const { t } = useTranslation('nutrition');
  const met = diversity.remaining === 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: deco.radius.lg,
        },
      ]}
      accessible
      accessibilityLabel={t('week.a11yProgress', {
        count: diversity.plantCount,
        target: diversity.target,
      })}
    >
      <View style={styles.headingRow}>
        <Text style={[typeScale.secondary, { color: theme.colors.onSurfaceVariant }]}>
          {t('week.plantsHeading')}
        </Text>
        <Text style={[typeScale.data, styles.count, { color: theme.colors.onSurface }]}>
          {t('week.count', { count: diversity.plantCount, target: diversity.target })}
        </Text>
      </View>

      {/*
        Drawn by hand: Paper's ProgressBar sizes its web wrapper to 100% height,
        which spread it over the weekday strip below. The track has its own
        token so the target reads before any plant is logged.
      */}
      <View style={[styles.bar, { backgroundColor: palette.track }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${clamp01(diversity.progress) * 100}%`,
              backgroundColor: met ? theme.colors.primary : theme.colors.secondary,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={[typeScale.caption, { color: theme.colors.onSurfaceVariant }]}>
          {met
            ? t('week.targetMet')
            : t('week.remaining', {
                count: diversity.remaining,
                target: diversity.target,
              })}
        </Text>
        <Text style={[typeScale.caption, { color: theme.colors.onSurfaceVariant }]}>
          {t('week.totalFoods', { count: diversity.totalCount })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.md,
    marginBottom: space.lg,
  },
  count: {
    fontSize: 17,
    lineHeight: 22,
  },
  // Both rows wrap: at large text the two halves stack instead of colliding.
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },
  /** Capsule: the radius is half the height. */
  bar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },
});
