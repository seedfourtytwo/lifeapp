import React from 'react';
import { View } from 'react-native';
import { ProgressBar, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { getTrackerCardChrome } from '../utils/trackerCardChrome';
import { trackerCardStyles as styles } from './trackerCardStyles';

export type TrackerCardProgress = {
  value: number;
  color: string;
  trackColor: string;
  height: number;
};

type Props = {
  children: React.ReactNode;
  /** Quantified trackers only — omit for tick-off habits. */
  progress?: TrackerCardProgress | null;
};

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Shared Home tracker card shell (View, not elevated Paper Card).
 * One fill/border for every kind; progress is the bar only.
 */
export default function TrackerCard({ children, progress = null }: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const chrome = getTrackerCardChrome({
    isCartoon,
    decorations: deco,
    fillColor: theme.colors.surface,
    outlineColor: theme.colors.outline,
  });

  return (
    <View style={[styles.card, chrome]}>
      <View style={styles.cardContent}>
        {children}
        {progress ? (
          <ProgressBar
            progress={clampProgress(progress.value)}
            color={progress.color}
            style={[
              styles.progressBar,
              {
                height: progress.height,
                backgroundColor: progress.trackColor,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}
