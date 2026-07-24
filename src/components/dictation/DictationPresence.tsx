import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Quiet ink for listening presence — not theme primary (often green). */
export const DICTATION_PRESENCE_COLOR = '#5B4B8A';

/**
 * One soft ripple: expand + fade. Never snaps opacity to zero mid-cycle,
 * so it reads as a wave, not a flash.
 */
function runRipple(value: Animated.Value, durationMs: number, gapMs: number) {
  value.setValue(0);
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(gapMs),
    ]),
  );
}

type HaloProps = {
  active: boolean;
  color?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Dual soft ripples around the mic — continuous, calm, no speech-vs-idle split
 * (wet ink already shows capture).
 */
export function DictationMicHalo({
  active,
  color = DICTATION_PRESENCE_COLOR,
  children,
  style,
}: HaloProps) {
  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      waveA.stopAnimation();
      waveB.stopAnimation();
      waveA.setValue(0);
      waveB.setValue(0);
      return;
    }
    const a = runRipple(waveA, 2200, 400);
    let b: Animated.CompositeAnimation | null = null;
    const lag = setTimeout(() => {
      b = runRipple(waveB, 2200, 400);
      b.start();
    }, 1100);
    a.start();
    return () => {
      clearTimeout(lag);
      a.stop();
      b?.stop();
    };
  }, [active, waveA, waveB]);

  const ringStyle = (wave: Animated.Value) => ({
    borderColor: color,
    opacity: wave.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0.42, 0.36, 0],
    }),
    transform: [
      {
        scale: wave.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.72],
        }),
      },
    ],
  });

  return (
    <View style={[styles.haloWrap, style]}>
      {active ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(waveA)]} />
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(waveB)]} />
        </>
      ) : null}
      <View style={styles.haloChild}>{children}</View>
    </View>
  );
}

type StageProps = {
  active: boolean;
  color?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

/**
 * Slow border breath on the note surface — same purple ink, no capture mode.
 */
export function DictationStageGlow({
  active,
  color = DICTATION_PRESENCE_COLOR,
  children,
  style,
  borderRadius = 10,
}: StageProps) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, breath]);

  const borderOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.55],
  });
  const washOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.07],
  });

  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
      {active ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: color,
                opacity: washOpacity,
                borderRadius,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.stageBorder,
              {
                borderColor: color,
                borderRadius,
                opacity: borderOpacity,
              },
            ]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  haloWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  haloChild: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
});
