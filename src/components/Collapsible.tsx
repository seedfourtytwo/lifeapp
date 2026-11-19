import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { timingOrSnap } from '../utils/motion';

/** How long a section takes to open or close. */
export const COLLAPSE_MS = 200;

type Props = {
  open: boolean;
  /** Layout of the body itself — its gap and padding. */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * A body that opens and closes in place: its height grows from nothing to
 * what its contents measure while it fades in, and the reverse on the way
 * out. Closed, the body is not mounted at all.
 *
 * Once open it lets go of the measured height, so a field appearing inside
 * resizes it the ordinary way. "Remove animations" lands on the end state.
 */
export function Collapsible({ open, contentStyle, children }: Props) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [mounted, setMounted] = useState(open);
  // False only while the height is being driven; true at rest, open or shut.
  const [settled, setSettled] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const wasOpen = useRef(open);
  // Read when a toggle starts; the setting changing must not replay one.
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    if (open) setMounted(true);
    setSettled(false);
    const animation = timingOrSnap(
      progress,
      {
        toValue: open ? 1 : 0,
        duration: COLLAPSE_MS,
        easing: Easing.inOut(Easing.cubic),
        // Height is layout: it cannot run on the native driver.
        useNativeDriver: false,
      },
      reduceMotionRef.current,
    );
    animation.start(({ finished }) => {
      if (!finished) return;
      setSettled(true);
      if (!open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress]);

  if (!mounted) return null;

  const height =
    settled && open
      ? undefined
      : progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] });

  return (
    <Animated.View testID="collapsible" style={[styles.clip, { height, opacity: progress }]}>
      <View
        style={contentStyle}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

type ChevronProps = {
  open: boolean;
  size: number;
  color: string;
};

/** One chevron that turns over as its section opens, rather than two glyphs swapped. */
export function CollapseChevron({ open, size, color }: ChevronProps) {
  const reduceMotion = useReduceMotion();
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    const animation = timingOrSnap(
      turn,
      {
        toValue: open ? 1 : 0,
        duration: COLLAPSE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      },
      reduceMotion,
    );
    animation.start();
    return () => animation.stop();
  }, [open, turn, reduceMotion]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialCommunityIcons name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
