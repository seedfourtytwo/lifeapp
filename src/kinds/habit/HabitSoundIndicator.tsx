import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { HabitCardSoundIndicator } from './habitCardLabels';

/**
 * Small enough to sit in the timer card's right rail without pushing the
 * elapsed clock or any button off the row.
 */
const SOUND_ICON_SIZE = 14;

type Props = {
  indicator: HabitCardSoundIndicator;
  /** Theme token from the caller — this component never picks a colour. */
  color: string;
};

/**
 * "This habit plays a sound, and here is what happens when the track ends."
 *
 * Labelled for screen readers: the rest of the card announces the name, the
 * streak, the elapsed time and each button, and none of them mention audio.
 */
export function HabitSoundIndicator({ indicator, color }: Props) {
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={indicator.accessibilityLabel}
    >
      <MaterialCommunityIcons
        name={indicator.icon}
        size={SOUND_ICON_SIZE}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * No height of its own: the glyph is a fixed size, and the row's `minHeight`
   * plus `alignItems: center` places it.
   */
  wrap: {
    flexShrink: 0,
    justifyContent: 'center',
  },
});
