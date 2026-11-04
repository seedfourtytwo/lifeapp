import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useDoneFill } from './useDoneFill';

/** The drawn ring; the touch target around it is the full 48. */
const RING = 30;
const TARGET = 48;

type Props = {
  done: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

/**
 * A habit's tick: an empty ring at rest, a solid moss disc with a check once
 * done. The ring is small so the row stays calm; the target is not.
 */
export function TrackerCardTick({ done, onPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const doneFill = useDoneFill(done);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={styles.target}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.ring}>
        <View style={[styles.outline, { borderColor: theme.colors.outlineVariant }]} />
        <Animated.View
          style={[styles.fill, { backgroundColor: theme.colors.primary, opacity: doneFill }]}
        >
          <MaterialCommunityIcons name="check" size={18} color={theme.colors.onPrimary} />
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
  /** The empty ring. The moss fill is drawn over it, so a done tick has no edge. */
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
