import { StyleSheet } from 'react-native';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

/**
 * Shared Home tracker row layout (tick-off, timer, counter).
 * Owned by TrackerCard + kind widgets — do not fork per kind.
 */
export const trackerCardStyles = StyleSheet.create({
  card: {
    marginBottom: layout.rowGap,
  },
  /** Tracker one-liner: disc and name · spacer · trailing actions. */
  oneLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.rowHeight,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: space.sm,
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
  /** Name and its streak caption — shrinks before the actions do. */
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typeScale.rowName,
  },
  caption: {
    ...typeScale.secondary,
  },
  /** Timer/count and the row's action — a tight right rail. */
  trailingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: space.sm,
  },
  timerLabel: {
    // Mono figures: a running clock stops jittering as the digits change.
    ...typeScale.timer,
    // Shrinks against the title rather than clipping at a fixed width, so a
    // scaled-up "1:02:44" stays whole.
    flexShrink: 1,
    textAlign: 'right',
  },
  /** Secondary row actions, e.g. today's note. */
  iconButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
});
