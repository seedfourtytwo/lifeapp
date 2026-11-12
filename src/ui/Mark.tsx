import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { MARK_SIZE, nightColors, nightRadius, nightState, nightStroke } from './tokens';

type Props = {
  icon: IconName;
  /** Pressed, it lets the icon be changed: the editor's icon tile. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** A thing's icon in a squircle: squircle glass is for things, round glass for tools. */
export function Mark({ icon, onPress, accessibilityLabel }: Props) {
  if (!onPress) {
    return (
      <View style={markStyles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={icon} size="md" />
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [markStyles.mark, pressed && markStyles.pressed]}
    >
      <Icon name={icon} size="md" />
    </Pressable>
  );
}

export const markStyles = StyleSheet.create({
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: nightRadius.inner,
    borderWidth: nightStroke.quiet,
    borderColor: nightColors.quietEdge,
    backgroundColor: nightColors.well,
  },
  pressed: {
    opacity: nightState.pressed,
  },
});
