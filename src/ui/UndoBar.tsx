import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { timingOrSnap } from '../utils/motion';
import { GlassFill } from './GlassFill';
import { NightText } from './NightText';
import { TextButton } from './TextButton';
import { nightColors, nightMotion, nightRadius, nightStroke, space, TOUCH_MIN } from './tokens';

export type UndoBarProps = {
  /** What just happened: "Water +2". */
  message: string;
  /** The way back, or another single action. Without one the bar is a plain notice. */
  action?: { label: string; onPress: () => void };
  /** Placed at the bottom of the screen above the navigation bar; off for showing it inline. */
  floating?: boolean;
};

/**
 * "Done, Undo" instead of "Are you sure?": the action has happened, and the
 * bar offers the way back. The one snack surface in the kit: a glass bar, a
 * line, at most one action. Fades in, or appears under reduced motion; says
 * its line to a screen reader. Usually shown through `useUndoBar()`.
 */
export function UndoBar({ message, action, floating = true }: UndoBarProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timingOrSnap(fade, { toValue: 1, duration: nightMotion.quick, useNativeDriver: true }, reduceMotion).start();
  }, [fade, reduceMotion]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      style={floating ? [undoBarStyles.floating, { bottom: insets.bottom + space.lg }] : null}
      pointerEvents="box-none"
    >
      <Animated.View testID="undo-bar" accessibilityLiveRegion="polite" style={[undoBarStyles.bar, { opacity: fade }]}>
        <GlassFill />
        <NightText kind="body" style={undoBarStyles.message}>
          {message}
        </NightText>
        {action ? <TextButton label={action.label} tone="cream" onPress={action.onPress} /> : null}
      </Animated.View>
    </View>
  );
}

export const undoBarStyles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
  },
  bar: {
    minHeight: TOUCH_MIN + space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    overflow: 'hidden',
    borderRadius: nightRadius.field,
    borderWidth: nightStroke.quiet,
    borderColor: nightColors.quietEdge,
    backgroundColor: nightColors.glassTop,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
  },
  message: {
    flexShrink: 1,
    flexGrow: 1,
  },
});
