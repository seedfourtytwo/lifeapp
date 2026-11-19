import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import DayStateCell from '../../components/history/DayStateCell';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

const SWATCH_WIDTH = 8;
const SWATCH_HEIGHT = 14;
const STATES = ['done', 'missed', 'skipped'] as const;

/** What the three marks mean, each drawn exactly as the grid draws it. */
export default function ReviewLegend() {
  const theme = useTheme();
  const { t } = useTranslation('review');
  const { decorations: deco, palette } = useAppTheme();

  return (
    <View style={styles.legend}>
      {STATES.map((state) => (
        <View key={state} style={styles.item}>
          <Svg width={SWATCH_WIDTH} height={SWATCH_HEIGHT}>
            <DayStateCell
              state={state}
              x={0}
              y={0}
              width={SWATCH_WIDTH}
              height={SWATCH_HEIGHT}
              radius={deco.radius.xs}
              strokeWidth={deco.borderWidth}
              ink={{ accent: palette.accent, quiet: theme.colors.onSurfaceVariant }}
            />
          </Svg>
          <QuietText style={typeScale.caption}>{t(`legend.${state}`)}</QuietText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.lg,
    rowGap: space.xs,
    paddingHorizontal: space.xxs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
