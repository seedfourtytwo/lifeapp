import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassFill } from './GlassFill';
import { nightColors, nightRadius, nightState, nightStroke, space, type NightLight } from './tokens';

type Props = {
  children: React.ReactNode;
  /** `surface`: a larger glass standing on its own. `tile`: one of a list, a little tighter. */
  size?: 'surface' | 'tile';
  /** A lit edge in this light: the tile's one lit feature. Leave it off when something inside is lit. */
  light?: NightLight;
  /** Makes the whole tile one control: a notebook, a choice in the "+" sheet. */
  onPress?: () => void;
  /** Said for the whole tile when it is pressable. */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A glass tile: the gradient, a 1dp edge along its top, its corners. No blur, no shadow. */
export function GlassSurface({ children, size = 'surface', light, onPress, accessibilityLabel, disabled, style }: Props) {
  const shape = [
    glassSurfaceStyles.surface,
    size === 'tile' && glassSurfaceStyles.tile,
    light && { borderWidth: nightStroke.lit, borderColor: nightColors[light] },
  ];
  const inside = (
    <>
      <GlassFill />
      <View style={[glassSurfaceStyles.edge, size === 'tile' && glassSurfaceStyles.tileEdge]} pointerEvents="none" />
      {children}
    </>
  );
  if (!onPress) return <View style={[shape, style]}>{inside}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        shape,
        style,
        pressed && glassSurfaceStyles.pressed,
        disabled && glassSurfaceStyles.disabled,
      ]}
    >
      {inside}
    </Pressable>
  );
}

export const glassSurfaceStyles = StyleSheet.create({
  surface: {
    borderRadius: nightRadius.surface,
    overflow: 'hidden',
    padding: space.lg,
    backgroundColor: nightColors.glassMiddle,
  },
  tile: {
    borderRadius: nightRadius.tile,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: nightRadius.surface,
    right: nightRadius.surface,
    borderTopWidth: nightStroke.quiet,
    borderTopColor: nightColors.glassEdge,
  },
  tileEdge: {
    left: nightRadius.tile,
    right: nightRadius.tile,
  },
  pressed: {
    opacity: nightState.pressed,
  },
  disabled: {
    opacity: nightState.disabled,
  },
});
