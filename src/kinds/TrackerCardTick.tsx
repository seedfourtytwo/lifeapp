import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useDoneFill } from './useDoneFill';

/** The drawn ring; the touch target around it is the full 48. */
const RING = 38;
const TARGET = 48;

type Props = {
  done: boolean;
  onPress: () => void;
  /** Opens the row's tray (e.g. Skip today). */
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
};

/**
 * A habit's tick: an empty ring in the tick colour at rest, a solid disc of it
 * with a check once done.
 */
export function TrackerCardTick({
  done,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { palette } = useAppTheme();
  const ink = palette.kind.tick.ink;
  const doneFill = useDoneFill(done);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      hitSlop={4}
      style={styles.target}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.ring}>
        <View style={[styles.outline, { borderColor: ink }]} />
        <Animated.View style={[styles.fill, { backgroundColor: ink, opacity: doneFill }]}>
          <MaterialCommunityIcons name="check" size={22} color={palette.onKind} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    width: TARGET,
    height: TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
  },
  /** The empty ring. The fill is drawn over it in the same colour. */
  outline: {
    ...StyleSheet.absoluteFillObject,
    // Geometry: a circle.
    borderRadius: RING / 2,
    borderWidth: 2,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
