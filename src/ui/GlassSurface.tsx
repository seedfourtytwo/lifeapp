import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../theme/spacing';
import { GlassFill } from './GlassFill';
import { nightColors, nightRadius, QUIET_STROKE } from './tokens';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A glass tile: the gradient, a 1dp edge along its top, its corners. No blur, no shadow. */
export function GlassSurface({ children, style }: Props) {
  return (
    <View style={[glassSurfaceStyles.surface, style]}>
      <GlassFill />
      <View style={glassSurfaceStyles.edge} pointerEvents="none" />
      {children}
    </View>
  );
}

export const glassSurfaceStyles = StyleSheet.create({
  surface: {
    borderRadius: nightRadius.surface,
    overflow: 'hidden',
    padding: space.lg,
    backgroundColor: nightColors.glassMiddle,
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: nightRadius.surface,
    right: nightRadius.surface,
    borderTopWidth: QUIET_STROKE,
    borderTopColor: nightColors.glassEdge,
  },
});
