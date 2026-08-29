import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the phone asks for reduced motion (Android: Settings → Accessibility
 * → Remove animations).
 *
 * Reads the current value on mount and stays subscribed, because the setting
 * can be toggled while the app is in the foreground — a quick-settings tile on
 * many Android builds — and an animation that only checked once would keep
 * running.
 *
 * Honour it by dropping the movement, not the information: hold a value at its
 * resting state, skip a loop, and let a transition land instantly. Anything the
 * animation was communicating still has to arrive.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
