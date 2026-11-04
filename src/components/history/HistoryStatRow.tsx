import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../QuietText';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { HistoryStat } from './historyStats';

/** The big figures over a history chart, each with a one-line caption. */
export default function HistoryStatRow({ stats }: { stats: readonly HistoryStat[] }) {
  const theme = useTheme();
  const { t } = useTranslation('insights');
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.id} style={styles.stat} accessible>
          <Text style={[typeScale.bigStat, { color: theme.colors.onSurface }]}>{stat.value}</Text>
          <QuietText style={typeScale.caption}>
            {t(stat.captionKey, { count: stat.count, unit: stat.unit })}
          </QuietText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.xl,
    rowGap: space.md,
    marginBottom: space.lg,
  },
  stat: {
    minWidth: 64,
  },
});
