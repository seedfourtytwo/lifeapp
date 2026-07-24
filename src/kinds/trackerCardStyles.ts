import { StyleSheet } from 'react-native';

/**
 * Shared Home tracker card layout (tick-off, timer, counter).
 * Owned by TrackerCard + kind widgets — do not fork per kind.
 */
export const trackerCardStyles = StyleSheet.create({
  card: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 0,
  },
  /** Habit one-liner: name/streak · meta · actions (titles share a left edge). */
  oneLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 52,
  },
  titlePress: {
    flex: 1,
    minWidth: 0,
  },
  titleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleIcon: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    fontWeight: '600',
    flexShrink: 1,
  },
  streakInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  streakCount: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  /** Timer/meta cluster on a one-liner — stable right rail with breathing room. */
  trailingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  timerLabel: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginRight: 4,
    flexShrink: 1,
    maxWidth: 120,
    textAlign: 'right',
  },
  /** Primary habit/counter actions — fill more of the card height. */
  iconButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
});
