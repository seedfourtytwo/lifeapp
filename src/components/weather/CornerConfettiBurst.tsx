import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface CornerConfettiHandle {
  /** Fire a burst at screen coords — no remount, no React state. */
  play: (x: number, y: number) => void;
}

type Particle = {
  angle: number;
  dist: number;
  color: string;
  size: number;
  shred?: boolean;
  spin?: number;
};

/** Mid-size set: rewarding but cheap once views are pre-mounted. */
const PARTICLES: Particle[] = [
  { angle: 0.2, dist: 30, color: '#E8A317', size: 5 },
  { angle: 1.0, dist: 36, color: '#5B9FCF', size: 4 },
  { angle: 1.9, dist: 32, color: '#E85D4C', size: 5 },
  { angle: 2.8, dist: 38, color: '#7C6BCF', size: 4 },
  { angle: 3.7, dist: 34, color: '#3D9B7A', size: 5 },
  { angle: 4.6, dist: 40, color: '#F0C24C', size: 4 },
  { angle: 5.4, dist: 33, color: '#E87A3A', size: 4 },
  { angle: 0.7, dist: 48, color: '#6BB8E8', size: 3 },
  { angle: 2.4, dist: 50, color: '#C45BD4', size: 3 },
  { angle: 4.2, dist: 46, color: '#F5C84A', size: 3 },
  { angle: 1.4, dist: 44, color: '#E8A317', size: 5, shred: true, spin: 50 },
  { angle: 3.3, dist: 47, color: '#5B9FCF', size: 5, shred: true, spin: -55 },
];

/**
 * Pre-mounted DVD-corner burst. Mount once with the chrome chip; call `play`
 * on corner hit so we never allocate native views mid-fling.
 */
const CornerConfettiBurst = forwardRef<CornerConfettiHandle>(function CornerConfettiBurst(
  _props,
  ref,
) {
  const originX = useRef(new Animated.Value(0)).current;
  const originY = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const sharedScale = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0.5, 1.12, 0.7],
      }),
    [progress],
  );

  const flashOpacity = useMemo(
    () =>
      opacity.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 0.65, 0],
      }),
    [opacity],
  );

  const flashScale = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1.9],
      }),
    [progress],
  );

  // Build translate/rotate nodes once — never during a fling frame.
  const particleMotion = useMemo(
    () =>
      PARTICLES.map((p) => {
        const tx = Math.cos(p.angle) * p.dist;
        const ty = Math.sin(p.angle) * p.dist;
        return {
          tx: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, tx],
          }),
          ty: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, ty],
          }),
          rotate: p.shred
            ? progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${p.spin ?? 45}deg`],
              })
            : null,
        };
      }),
    [progress],
  );

  const play = useCallback(
    (x: number, y: number) => {
      running.current?.stop();
      originX.setValue(x);
      originY.setValue(y);
      progress.setValue(0);
      opacity.setValue(1);
      running.current = Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          delay: 220,
          useNativeDriver: true,
        }),
      ]);
      running.current.start(({ finished }) => {
        if (finished) opacity.setValue(0);
        running.current = null;
      });
    },
    [opacity, originX, originY, progress],
  );

  useImperativeHandle(ref, () => ({ play }), [play]);

  // Warm the native animation graph once after mount (invisible).
  useEffect(() => {
    progress.setValue(0);
    opacity.setValue(0);
    const warm = Animated.timing(progress, {
      toValue: 0.001,
      duration: 1,
      useNativeDriver: true,
    });
    warm.start();
    return () => {
      warm.stop();
      running.current?.stop();
    };
  }, [opacity, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.origin,
          {
            transform: [{ translateX: originX }, { translateY: originY }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.flash,
            {
              opacity: flashOpacity,
              transform: [{ scale: flashScale }],
            },
          ]}
        />
        {PARTICLES.map((p, i) => {
          const motion = particleMotion[i]!;
          const w = p.shred ? p.size * 0.45 : p.size;
          const h = p.shred ? p.size * 1.55 : p.size;
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: w,
                  height: h,
                  borderRadius: p.shred ? 1.5 : p.size / 2,
                  backgroundColor: p.color,
                  opacity,
                  transform: [
                    { translateX: motion.tx },
                    { translateY: motion.ty },
                    { scale: sharedScale },
                    ...(motion.rotate ? [{ rotate: motion.rotate }] : []),
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
});

export default CornerConfettiBurst;

const styles = StyleSheet.create({
  origin: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  flash: {
    position: 'absolute',
    left: -12,
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF6E8',
  },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    marginLeft: -2,
    marginTop: -2,
  },
});
