import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import QuietText from '../../components/QuietText';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { layout, space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { timingOrSnap } from '../../utils/motion';

/**
 * Whether the page has painted its first full list. What is there at first
 * paint simply is; only what turns up afterwards arrives. A ref, so flipping
 * it re-renders nothing.
 */
export const TodaySettledContext = createContext<{ readonly current: boolean }>({
  current: true,
});

const ARRIVE_MS = 180;
/** How far below its place an arriving row starts. */
const ARRIVE_RISE = space.sm;

/**
 * A row or heading that turns up after first paint — a habit sinking to Done,
 * a timer rising to Now — fades up into place instead of popping in. Under
 * reduced motion it is simply there.
 */
export function Appear({ children }: { children: React.ReactNode }) {
  const settled = useContext(TodaySettledContext);
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(settled.current ? 0 : 1)).current;

  useEffect(() => {
    const arrival = timingOrSnap(
      progress,
      { toValue: 1, duration: ARRIVE_MS, useNativeDriver: true },
      reduceMotion,
    );
    arrival.start();
    return () => arrival.stop();
  }, [progress, reduceMotion]);

  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [ARRIVE_RISE, 0] });
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY: rise }] }}>
      {children}
    </Animated.View>
  );
}

type LabelProps = {
  children: string;
  /** Nothing sits above it but the day header, which brings its own gap. */
  first?: boolean;
};

/** "Now", "Todos", "Done": a plain caption in the quiet ink. */
export function SectionLabel({ children, first = false }: LabelProps) {
  return (
    <Appear>
      <QuietText accessibilityRole="header" style={[styles.label, !first && styles.spaced]}>
        {children}
      </QuietText>
    </Appear>
  );
}

/** The gap above a section: a section's breath, less the row gap already there. */
export const SECTION_TOP_GAP = layout.sectionGap - layout.rowGap;

const styles = StyleSheet.create({
  label: {
    ...typeScale.caption,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  spaced: {
    marginTop: SECTION_TOP_GAP,
  },
});
