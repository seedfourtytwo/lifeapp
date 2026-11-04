import React from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerCardProgressFill } from './TrackerCardProgressFill';

export type TrackerCardProgress = {
  value: number;
  color: string;
  /** Kept for call-site compatibility; unused (fill uses accent color). */
  trackColor: string;
  /** Kept for call-site compatibility; unused (fill is full-height wash). */
  height: number;
};

type Props = {
  children: React.ReactNode;
  /** Quantified trackers only — omit for tick-off habits. */
  progress?: TrackerCardProgress | null;
};

/**
 * Shared Home tracker card shell: a tile on the stepped page, no outline.
 * Progress is an inner wash.
 */
export default function TrackerCard({ children, progress = null }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const chrome = { borderRadius: deco.radius.lg, backgroundColor: theme.colors.surface };

  return (
    <View style={[styles.card, chrome]}>
      {progress ? (
        <TrackerCardProgressFill
          progress={progress.value}
          color={progress.color}
          borderRadius={deco.radius.lg}
        />
      ) : null}
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}
