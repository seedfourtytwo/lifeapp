import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { springOrSnap } from '../utils/motion';

/**
 * 0 → 1 as a row turns done, for the colour that floods its tick.
 * A short, unbouncy spring (about 160ms); reduced motion lands on the end state.
 */
export function useDoneFill(done: boolean): Animated.Value {
  const reduceMotion = useReduceMotion();
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    springOrSnap(
      fill,
      { toValue: done ? 1 : 0, speed: 40, bounciness: 0, useNativeDriver: true },
      reduceMotion,
    ).start();
  }, [done, fill, reduceMotion]);

  return fill;
}
