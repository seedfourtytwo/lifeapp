import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Armed (session on, not capturing) — cool ink, not theme primary. */
export const DICTATION_PRESENCE_COLOR = '#5B4B8A';
export const DICTATION_PRESENCE_COLOR_DARK = '#9B8BC4';

/** Capturing — dusty rose, distinct from armed and from error red. */
export const DICTATION_LIVE_COLOR = '#A64D63';
export const DICTATION_LIVE_COLOR_DARK = '#E39AAA';

export const DICTATION_ARMED_FILL = 'rgba(91, 75, 138, 0.18)';
export const DICTATION_ARMED_FILL_DARK = 'rgba(155, 139, 196, 0.28)';
export const DICTATION_LIVE_FILL = 'rgba(166, 77, 99, 0.20)';
export const DICTATION_LIVE_FILL_DARK = 'rgba(227, 154, 170, 0.28)';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_INOUT = Easing.bezier(0.42, 0, 0.58, 1);
const MODE_MS = 280;
const BREATH_MS = 1200;

type HaloProps = {
  preparing?: boolean;
  listening?: boolean;
  capturing?: boolean;
  finishing?: boolean;
  /** Session-on, waiting / preparing. */
  color?: string;
  /** Speech — warmer, only while capturing. */
  liveColor?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Presence intensity: 0 idle · 0.22 finishing · 0.36 preparing · 0.58 pause · 1 speech
 */
function presenceLevel(props: {
  preparing: boolean;
  listening: boolean;
  capturing: boolean;
  finishing: boolean;
}): number {
  if (props.finishing) return 0.22;
  if (props.preparing) return 0.36;
  if (props.listening && props.capturing) return 1;
  if (props.listening) return 0.58;
  return 0;
}

function breathLoop(value: Animated.Value) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: BREATH_MS,
        easing: EASE_INOUT,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: BREATH_MS,
        easing: EASE_INOUT,
        useNativeDriver: true,
      }),
    ]),
  );
}

/**
 * Cool fill while armed, dusty rose while capturing.
 * Layers stay mounted through fade-out so modes never snap.
 */
export function DictationMicHalo({
  preparing = false,
  listening = false,
  capturing = false,
  finishing = false,
  color = DICTATION_PRESENCE_COLOR,
  liveColor = DICTATION_LIVE_COLOR,
  children,
  style,
}: HaloProps) {
  const level = presenceLevel({ preparing, listening, capturing, finishing });
  const presence = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const breathB = useRef(new Animated.Value(0)).current;
  const [layersOn, setLayersOn] = useState(false);
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

  useEffect(() => {
    if (level > 0) setLayersOn(true);
    const anim = Animated.timing(presence, {
      toValue: level,
      duration: MODE_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && level === 0) setLayersOn(false);
    });
    return () => anim.stop();
  }, [level, presence]);

  useEffect(() => {
    if (!layersOn || reduceMotion) {
      breath.stopAnimation();
      breathB.stopAnimation();
      breath.setValue(layersOn ? 0.5 : 0);
      breathB.setValue(layersOn ? 0.5 : 0);
      return;
    }

    breath.setValue(0);
    breathB.setValue(0);
    const loopA = breathLoop(breath);
    const loopB = breathLoop(breathB);
    loopA.start();
    const offset = setTimeout(() => loopB.start(), BREATH_MS);
    return () => {
      clearTimeout(offset);
      loopA.stop();
      loopB.stop();
    };
  }, [layersOn, reduceMotion, breath, breathB]);

  const breathMul = breath.interpolate({
    inputRange: [0, 1],
    outputRange: reduceMotion ? [1, 1] : [0.82, 1],
  });
  const armedAmt = presence.interpolate({
    inputRange: [0, 0.36, 0.58, 1],
    outputRange: [0, 1, 1, 0.28],
    extrapolate: 'clamp',
  });
  const liveAmt = presence.interpolate({
    inputRange: [0.7, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const bloomScale = reduceMotion
    ? 1
    : Animated.add(
        1,
        Animated.multiply(
          breath,
          presence.interpolate({
            inputRange: [0, 0.36, 0.58, 1],
            outputRange: [0, 0.04, 0.06, 0.12],
          }),
        ),
      );
  const ringScale = reduceMotion
    ? 1.12
    : Animated.add(
        1.1,
        Animated.multiply(
          breath,
          presence.interpolate({
            inputRange: [0, 0.58, 1],
            outputRange: [0.04, 0.1, 0.2],
          }),
        ),
      );
  const speechRingScale = reduceMotion
    ? 1
    : Animated.add(1.12, Animated.multiply(breathB, 0.22));

  const armedBloom = Animated.multiply(
    armedAmt,
    Animated.multiply(breathMul, 0.2),
  );
  const armedCore = Animated.multiply(
    armedAmt,
    Animated.multiply(breathMul, 0.28),
  );
  const armedRing = Animated.multiply(
    armedAmt,
    breath.interpolate({
      inputRange: [0, 0.42, 1],
      outputRange: reduceMotion ? [0.32, 0.32, 0.32] : [0.2, 0.55, 0.1],
    }),
  );
  const liveBloom = Animated.multiply(
    liveAmt,
    Animated.multiply(breathMul, 0.26),
  );
  const liveCore = Animated.multiply(
    liveAmt,
    Animated.multiply(breathMul, 0.34),
  );
  const liveRing = Animated.multiply(
    liveAmt,
    breathB.interpolate({
      inputRange: [0, 0.42, 1],
      outputRange: reduceMotion ? [0, 0, 0] : [0.18, 0.5, 0.08],
    }),
  );

  return (
    <View style={[styles.haloWrap, style]}>
      {layersOn ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bloom,
              {
                backgroundColor: color,
                opacity: armedBloom,
                transform: [{ scale: bloomScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.core,
              {
                backgroundColor: color,
                opacity: armedCore,
                transform: [{ scale: bloomScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bloom,
              {
                backgroundColor: liveColor,
                opacity: liveBloom,
                transform: [{ scale: bloomScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.core,
              {
                backgroundColor: liveColor,
                opacity: liveCore,
                transform: [{ scale: bloomScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: color,
                opacity: armedRing,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: liveColor,
                opacity: liveRing,
                transform: [{ scale: speechRingScale }],
              },
            ]}
          />
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
 * Quiet wash on the note surface while speech is landing.
 */
export function DictationStageGlow({
  active,
  color = DICTATION_LIVE_COLOR,
  children,
  style,
  borderRadius = 10,
}: StageProps) {
  const shown = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(shown, {
      toValue: active ? 1 : 0,
      duration: MODE_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [active, shown]);

  useEffect(() => {
    if (!active) {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }
    const loop = breathLoop(breath);
    loop.start();
    return () => loop.stop();
  }, [active, breath]);

  const washOpacity = Animated.multiply(
    shown,
    breath.interpolate({
      inputRange: [0, 1],
      outputRange: [0.03, 0.06],
    }),
  );
  const borderOpacity = Animated.multiply(
    shown,
    breath.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.34],
    }),
  );

  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
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
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  haloWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bloom: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  core: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  haloChild: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
});
