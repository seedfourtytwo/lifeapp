import { StyleSheet } from 'react-native';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

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
    paddingVertical: 6,
    gap: 0,
  },
  /** Tracker one-liner: identity · spacer · trailing actions. */
  oneLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
  },
  titlePress: {
    flex: 1,
    minWidth: 0,
  },
  titleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pressed: {
    opacity: 0.7,
  },
  /** Name and, for text-only rows, its streak — shrinks before the actions do. */
  nameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  name: {
    fontWeight: '500',
    flexShrink: 1,
  },
  /** Timer/meta cluster — tight right rail. */
  trailingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  timerLabel: {
    // Mono figures: a running clock stops jittering as the digits change.
    ...typeScale.timer,
    marginRight: 2,
    // Shrinks against the title rather than clipping at a fixed width, so a
    // scaled-up "1:02:44" stays whole.
    flexShrink: 1,
    textAlign: 'right',
  },
  /** Primary habit/counter actions — fill more of the card height. */
  iconButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
});
