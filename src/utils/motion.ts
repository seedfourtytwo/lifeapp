import { Animated } from 'react-native';

/**
 * Animations that respect "remove animations" without losing what they said.
 *
 * A reduced-motion phone still needs the end state: a panel that expanded is
 * expanded, a dragged row is back in place, a badge that faded in is visible.
 * These helpers keep the same `CompositeAnimation` contract — including the
 * `start()` callback that call sites use for cleanup — and only take the travel
 * out of it, by running the same change over zero milliseconds.
 *
 * Effects that say nothing on their own (a confetti burst, an edge flash)
 * are not animated more quietly; they are skipped at the call site.
 */

type Snapable = { toValue: number; useNativeDriver: boolean };

/** A spring, or an instant jump to the same value under reduced motion. */
export function springOrSnap(
  value: Animated.Value,
  config: Animated.SpringAnimationConfig & Snapable,
  reduceMotion: boolean,
): Animated.CompositeAnimation {
  if (!reduceMotion) return Animated.spring(value, config);
  return Animated.timing(value, {
    toValue: config.toValue,
    duration: 0,
    useNativeDriver: config.useNativeDriver,
  });
}

/** A timing, or the same end value with the duration removed. */
export function timingOrSnap(
  value: Animated.Value,
  config: Animated.TimingAnimationConfig & Snapable,
  reduceMotion: boolean,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    ...config,
    duration: reduceMotion ? 0 : config.duration,
    delay: reduceMotion ? 0 : config.delay,
  });
}
