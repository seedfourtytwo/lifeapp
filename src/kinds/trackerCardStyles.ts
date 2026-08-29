import { StyleSheet } from 'react-native';
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
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    fontWeight: '600',
    flexShrink: 1,
  },
  /** Whispered label while reordering an icon-only row. */
  reorderNameWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 4,
  },
  reorderName: {
    fontWeight: '500',
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
