import React from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { getTrackerCardChrome } from '../utils/trackerCardChrome';
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

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Shared Home tracker card shell.
 * Same outer border for every card; progress is an inner wash/edge glow.
 */
export default function TrackerCard({ children, progress = null }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const chrome = getTrackerCardChrome({
    decorations: deco,
    fillColor: theme.colors.surface,
    outlineColor: theme.colors.outline,
  });

  return (
    <View style={[styles.card, chrome]}>
      {progress ? (
        <TrackerCardProgressFill
          progress={clampProgress(progress.value)}
          color={progress.color}
          borderRadius={deco.radius.md}
        />
      ) : null}
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}
