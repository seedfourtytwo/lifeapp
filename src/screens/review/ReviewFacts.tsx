import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

/** The three figures over the heat map. */
export interface ReviewFactValues {
  /** Days of the range where everything planned was done. */
  fullDays: number;
  /** Full days in a row up to now. */
  run: number;
  /** A short weekday name; null when the range is too thin to name one. */
  bestDay: string | null;
}

type Props = {
  /** Null until the first load lands: the tiles keep their place, with dashes. */
  facts: ReviewFactValues | null;
};

const DASH = '–';

/** Three tiles in a row: a figure in the mono face over a quiet caption. */
export default function ReviewFacts({ facts }: Props) {
  const { t } = useTranslation('review');
  const fullDays = t('facts.fullDays', { count: facts?.fullDays ?? 0 });
  const run = t('facts.run', { count: facts?.run ?? 0 });
  const bestDay = t('facts.bestDay');

  return (
    <View style={styles.row}>
      <Fact figure={facts ? String(facts.fullDays) : DASH} caption={fullDays} />
      <Fact figure={facts ? String(facts.run) : DASH} caption={run} />
      <Fact
        figure={facts?.bestDay ?? DASH}
        caption={bestDay}
        spoken={facts?.bestDay ? undefined : t('facts.bestDayUnknown')}
      />
    </View>
  );
}

type FactProps = {
  figure: string;
  caption: string;
  /** Said in place of "figure caption" when the figure is a dash. */
  spoken?: string;
};

function Fact({ figure, caption, spoken }: FactProps) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={spoken ?? `${figure} ${caption}`}
      style={[styles.tile, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }]}
    >
      {/* One line that shrinks: a weekday name must not wrap or clip at a large font size. */}
      <Text numberOfLines={1} adjustsFontSizeToFit style={[typeScale.bigStat, { color: theme.colors.onSurface }]}>
        {figure}
      </Text>
      <QuietText style={typeScale.caption}>{caption}</QuietText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  /** Tiles share the row evenly and grow together when a caption wraps. */
  tile: {
    flex: 1,
    padding: space.md,
    gap: space.xs,
  },
});
