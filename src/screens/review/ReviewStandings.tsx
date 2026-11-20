import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { TrackerCardFigure } from '../../kinds/TrackerCardFigure';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { StandingRow } from './reviewRows';

type Props = {
  title: string;
  /** Best first. With none, the section is not drawn at all. */
  rows: readonly StandingRow[];
  onOpenTracker: (trackerId: string) => void;
};

const ROW_MIN_HEIGHT = 40;
const DOT = 10;

/**
 * Holding, or Slipping: one tile of trackers, each a dot in its kind's colour,
 * its name, a bar filled to the share of its plan it did, and the tally.
 * Tapping a row opens that tracker's history.
 */
export default function ReviewStandings({ title, rows, onOpenTracker }: Props) {
  const theme = useTheme();
  const { t } = useTranslation(['review', 'trackers']);
  const { decorations: deco, palette } = useAppTheme();
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <QuietText accessibilityRole="header" style={[typeScale.secondary, styles.title]}>
        {title}
      </QuietText>
      <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }]}>
        {rows.map((row) => {
          const { ink } = palette.kind[row.kind];
          return (
            <Pressable
              key={row.id}
              onPress={() => onOpenTracker(row.id)}
              accessibilityRole="button"
              accessibilityLabel={t(row.spoken.key, row.spoken.params)}
              accessibilityHint={t('trackers:homeIdentity.historyHint')}
              style={({ pressed }) => [
                styles.row,
                { borderRadius: deco.radius.sm },
                pressed && { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: ink, borderRadius: deco.radius.xs }]} />
              <Text numberOfLines={1} style={[typeScale.secondary, styles.name, { color: theme.colors.onSurface }]}>
                {row.name}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: deco.progressHeight, borderRadius: deco.radius.pill, backgroundColor: palette.track },
                ]}
              >
                <View
                  style={[
                    styles.fill,
                    { width: `${row.share * 100}%`, borderRadius: deco.radius.pill, backgroundColor: ink },
                  ]}
                />
              </View>
              <TrackerCardFigure figure={row.figure} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  title: {
    paddingHorizontal: space.xxs,
  },
  tile: {
    padding: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  dot: {
    width: DOT,
    height: DOT,
  },
  /** The name takes twice the bar's share of what the dot and the tally leave. */
  name: {
    flex: 2,
  },
  bar: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
