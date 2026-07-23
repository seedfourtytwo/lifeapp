import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  type GestureResponderHandlers,
} from 'react-native';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  clampBubblePosition,
  getBubblePixelBounds,
  type BubbleChipSize,
  type BubbleLayout,
} from '../weather/bubblePosition';
import {
  BUBBLE_CHARGE_ARM_MS,
  BUBBLE_CHARGE_MS,
  appendMotionSample,
  cornerIdFromEdges,
  resolveBubbleRelease,
  stepBubblePhysics,
  velocityFromSamples,
  BUBBLE_CHARGE_LAUNCH_MIN,
  type BubbleHitEdges,
  type BubbleMotionSample,
} from '../weather/bubblePhysics';
import {
  playBubbleBounceHaptic,
  playBubbleCornerHaptic,
  playBubbleThrowHaptic,
  playChartSelectHaptic,
  playHabitCompleteHaptic,
} from '../utils/habitHaptics';

const TAP_SLOP = 8;
const BOUNCE_HAPTIC_MIN_MS = 90;
const CHARGE_UI_MIN_MS = 80;

interface Options {
  savedX: number;
  savedY: number;
  setBubblePosition: (x: number, y: number) => void | Promise<void>;
  topInset: number;
  bottomInset: number;
  chipWidth?: number;
  chipHeight?: number;
  onTap: () => void;
  onDragStart?: () => void;
  onCornerHit?: (x: number, y: number) => void;
  /** Any wall/corner bounce — for edge flash feedback. */
  onBounce?: (hit: {
    edges: BubbleHitEdges;
    /** True when this bounce also scored a DVD corner. */
    scoredCorner: boolean;
    chipX: number;
    chipY: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }) => void;
}

/**
 * Drag + fling/bounce for the home weather chip.
 * Slow drag places precisely; still-hold charges; flick throws.
 */
export function useChromeBubbleDrag({
  savedX,
  savedY,
  setBubblePosition,
  topInset,
  bottomInset,
  chipWidth = BUBBLE_WIDTH,
  chipHeight = BUBBLE_HEIGHT,
  onTap,
  onDragStart,
  onCornerHit,
  onBounce,
}: Options): {
  panHandlers: GestureResponderHandlers;
  leftAnim: Animated.Value;
  topAnim: Animated.Value;
  chargeProgress: number;
  layout: { width: number; height: number };
  onLayout: (width: number, height: number) => void;
  bubbleLeft: number;
  bubbleTop: number;
} {
  const [layout, setLayout] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  const [pos, setPos] = useState({ x: savedX, y: savedY });
  const [chargeProgress, setChargeProgress] = useState(0);

  const chipRef = useRef<BubbleChipSize>({ width: chipWidth, height: chipHeight });
  chipRef.current = { width: chipWidth, height: chipHeight };

  const initialClamped = clampBubblePosition(
    savedX,
    savedY,
    { width: layout.width, height: layout.height, topInset, bottomInset },
    chipRef.current,
  );
  const leftAnim = useRef(new Animated.Value(initialClamped.x * layout.width)).current;
  const topAnim = useRef(new Animated.Value(initialClamped.y * layout.height)).current;

  const layoutRef = useRef(layout);
  const insetsRef = useRef({ top: topInset, bottom: bottomInset });
  const posRef = useRef(pos);
  const dragOrigin = useRef(pos);
  const moved = useRef(false);
  const physicsRaf = useRef<number | null>(null);
  const interactingRef = useRef(false);
  const motionSamples = useRef<BubbleMotionSample[]>([]);
  const chargeRef = useRef(0);
  const chargeStarted = useRef(false);
  const chargeAnimValue = useRef(new Animated.Value(0)).current;
  const chargeAnimHandle = useRef<Animated.CompositeAnimation | null>(null);
  const chargeListenerId = useRef<string | null>(null);
  const chargeArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halfChargeTick = useRef(false);
  const fullChargeTick = useRef(false);
  const lastChargeUiAt = useRef(0);
  const aimRef = useRef<{ x: number; y: number } | null>(null);
  const setBubblePositionRef = useRef(setBubblePosition);
  const onTapRef = useRef(onTap);
  const onDragStartRef = useRef(onDragStart);
  const onCornerHitRef = useRef(onCornerHit);
  const onBounceRef = useRef(onBounce);
  const startPhysicsRef = useRef<(vx: number, vy: number) => void>(() => {});
  const startChargeRef = useRef<() => void>(() => {});

  layoutRef.current = layout;
  insetsRef.current = { top: topInset, bottom: bottomInset };
  posRef.current = pos;
  setBubblePositionRef.current = setBubblePosition;
  onTapRef.current = onTap;
  onDragStartRef.current = onDragStart;
  onCornerHitRef.current = onCornerHit;
  onBounceRef.current = onBounce;

  const bubbleLayout = useCallback((): BubbleLayout => {
    const { width, height } = layoutRef.current;
    const { top, bottom } = insetsRef.current;
    return { width, height, topInset: top, bottomInset: bottom };
  }, []);

  const syncAnimFromNorm = useCallback(
    (norm: { x: number; y: number }) => {
      const { width, height } = layoutRef.current;
      leftAnim.setValue(norm.x * width);
      topAnim.setValue(norm.y * height);
    },
    [leftAnim, topAnim],
  );

  const persistNorm = useCallback((next: { x: number; y: number }) => {
    posRef.current = next;
    setPos(next);
    syncAnimFromNorm(next);
    void setBubblePositionRef.current(next.x, next.y);
  }, [syncAnimFromNorm]);

  const placeHere = useCallback(() => {
    interactingRef.current = false;
    const clamped = clampBubblePosition(
      posRef.current.x,
      posRef.current.y,
      bubbleLayout(),
      chipRef.current,
    );
    persistNorm(clamped);
  }, [bubbleLayout, persistNorm]);

  const stopPhysics = useCallback(() => {
    if (physicsRaf.current != null) {
      cancelAnimationFrame(physicsRaf.current);
      physicsRaf.current = null;
    }
  }, []);

  const clearChargeArm = useCallback(() => {
    if (chargeArmTimer.current) {
      clearTimeout(chargeArmTimer.current);
      chargeArmTimer.current = null;
    }
  }, []);

  const publishChargeUi = useCallback((p: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastChargeUiAt.current < CHARGE_UI_MIN_MS && p < 1) return;
    lastChargeUiAt.current = now;
    setChargeProgress(p);
  }, []);

  const detachChargeListener = useCallback(() => {
    if (chargeListenerId.current != null) {
      chargeAnimValue.removeListener(chargeListenerId.current);
      chargeListenerId.current = null;
    }
  }, [chargeAnimValue]);

  const stopCharge = useCallback(() => {
    clearChargeArm();
    chargeAnimHandle.current?.stop();
    chargeAnimHandle.current = null;
    detachChargeListener();
    chargeStarted.current = false;
    chargeRef.current = 0;
    chargeAnimValue.setValue(0);
    halfChargeTick.current = false;
    fullChargeTick.current = false;
    lastChargeUiAt.current = 0;
    setChargeProgress(0);
  }, [clearChargeArm, chargeAnimValue, detachChargeListener]);

  /** Fill while the finger is held — moving does not pause or reset. */
  const startCharge = useCallback(() => {
    if (chargeStarted.current) return;
    chargeStarted.current = true;
    halfChargeTick.current = false;
    fullChargeTick.current = false;
    chargeRef.current = 0;
    chargeAnimValue.setValue(0);
    publishChargeUi(0, true);

    detachChargeListener();
    chargeListenerId.current = chargeAnimValue.addListener(({ value }) => {
      chargeRef.current = value;
      publishChargeUi(value);
      if (value >= 0.5 && !halfChargeTick.current) {
        halfChargeTick.current = true;
        void playChartSelectHaptic();
      }
      if (value >= 0.98 && !fullChargeTick.current) {
        fullChargeTick.current = true;
        void playHabitCompleteHaptic();
      }
    });

    const anim = Animated.timing(chargeAnimValue, {
      toValue: 1,
      duration: BUBBLE_CHARGE_MS,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: false,
    });
    chargeAnimHandle.current = anim;
    anim.start(({ finished }) => {
      chargeAnimHandle.current = null;
      if (finished) {
        chargeRef.current = 1;
        publishChargeUi(1, true);
      }
    });
  }, [chargeAnimValue, detachChargeListener, publishChargeUi]);

  startChargeRef.current = startCharge;

  /** Short delay so a quick tap does not flash the ring. */
  const armChargeOnHold = useCallback(() => {
    clearChargeArm();
    chargeArmTimer.current = setTimeout(() => {
      chargeArmTimer.current = null;
      startChargeRef.current();
    }, BUBBLE_CHARGE_ARM_MS);
  }, [clearChargeArm]);

  startPhysicsRef.current = (vxPx: number, vyPx: number) => {
    stopPhysics();
    stopCharge();
    const layoutNow = bubbleLayout();
    const chip = chipRef.current;
    const { width, height } = layoutNow;
    if (width <= 0 || height <= 0) {
      placeHere();
      return;
    }

    const bounds = getBubblePixelBounds(layoutNow, chip);
    let state = {
      x: posRef.current.x * width,
      y: posRef.current.y * height,
      vx: vxPx,
      vy: vyPx,
    };
    let lastTs = performance.now();
    let lastCornerId: ReturnType<typeof cornerIdFromEdges> = null;
    let lastCornerHapticAt = 0;
    let lastBounceHapticAt = 0;
    interactingRef.current = true;

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - lastTs) / 1000);
      lastTs = now;
      const stepped = stepBubblePhysics(state, bounds, dt);
      state = stepped.state;
      leftAnim.setValue(state.x);
      topAnim.setValue(state.y);
      posRef.current = { x: state.x / width, y: state.y / height };

      let scoredCorner = false;
      if (stepped.cornerHit) {
        const id = cornerIdFromEdges(stepped.hitEdges);
        // Score each distinct corner once; clearing when we leave lets the
        // next bank count even if corners arrive <90ms apart at full charge.
        if (id != null && id !== lastCornerId) {
          lastCornerId = id;
          scoredCorner = true;
          const cx = state.x + chip.width / 2;
          const cy = state.y + chip.height / 2;
          const t = performance.now();
          requestAnimationFrame(() => {
            onCornerHitRef.current?.(cx, cy);
            if (t - lastCornerHapticAt >= BOUNCE_HAPTIC_MIN_MS) {
              lastCornerHapticAt = t;
              void playBubbleCornerHaptic();
            }
          });
        }
      } else {
        lastCornerId = null;
        if (stepped.wallHit) {
          const t = performance.now();
          if (t - lastBounceHapticAt >= BOUNCE_HAPTIC_MIN_MS) {
            lastBounceHapticAt = t;
            void playBubbleBounceHaptic();
          }
        }
      }

      if (stepped.wallHit) {
        const chipX = state.x;
        const chipY = state.y;
        const edges = stepped.hitEdges;
        requestAnimationFrame(() => {
          onBounceRef.current?.({ edges, scoredCorner, chipX, chipY, bounds });
        });
      }

      if (stepped.settled) {
        physicsRaf.current = null;
        const clamped = clampBubblePosition(
          posRef.current.x,
          posRef.current.y,
          layoutNow,
          chip,
        );
        persistNorm(clamped);
        interactingRef.current = false;
        return;
      }
      physicsRaf.current = requestAnimationFrame(tick);
    };

    physicsRaf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (interactingRef.current || physicsRaf.current != null) return;
    const clamped = clampBubblePosition(savedX, savedY, bubbleLayout(), chipRef.current);
    posRef.current = clamped;
    setPos(clamped);
    syncAnimFromNorm(clamped);
  }, [savedX, savedY, bubbleLayout, syncAnimFromNorm]);

  useEffect(() => {
    if (interactingRef.current || physicsRaf.current != null) return;
    const clamped = clampBubblePosition(
      posRef.current.x,
      posRef.current.y,
      bubbleLayout(),
      { width: chipWidth, height: chipHeight },
    );
    posRef.current = clamped;
    setPos(clamped);
    syncAnimFromNorm(clamped);
  }, [
    layout.width,
    layout.height,
    topInset,
    bottomInset,
    chipWidth,
    chipHeight,
    bubbleLayout,
    syncAnimFromNorm,
  ]);

  useEffect(
    () => () => {
      stopPhysics();
      stopCharge();
    },
    [stopPhysics, stopCharge],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          stopPhysics();
          stopCharge();
          interactingRef.current = true;
          dragOrigin.current = posRef.current;
          moved.current = false;
          aimRef.current = null;
          const { width, height } = layoutRef.current;
          motionSamples.current = [
            {
              t: Date.now(),
              x: posRef.current.x * Math.max(width, 1),
              y: posRef.current.y * Math.max(height, 1),
            },
          ];
          armChargeOnHold();
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP) {
            if (!moved.current) onDragStartRef.current?.();
            moved.current = true;
            // Charge is hold-linked: keep filling while aiming / dragging.
          }
          const layoutNow = bubbleLayout();
          const { width, height } = layoutNow;
          const w = Math.max(width, 1);
          const h = Math.max(height, 1);
          appendMotionSample(motionSamples.current, {
            t: Date.now(),
            x: dragOrigin.current.x * w + gesture.dx,
            y: dragOrigin.current.y * h + gesture.dy,
          });
          if (Math.hypot(gesture.dx, gesture.dy) >= TAP_SLOP) {
            aimRef.current = { x: gesture.dx, y: gesture.dy };
          }
          const next = clampBubblePosition(
            dragOrigin.current.x + gesture.dx / w,
            dragOrigin.current.y + gesture.dy / h,
            layoutNow,
            chipRef.current,
          );
          posRef.current = next;
          leftAnim.setValue(next.x * w);
          topAnim.setValue(next.y * h);
        },
        onPanResponderRelease: () => {
          clearChargeArm();
          const raw = velocityFromSamples(motionSamples.current);
          const charge = chargeRef.current;
          const release = resolveBubbleRelease({
            moved: moved.current,
            fingerVx: raw.vx,
            fingerVy: raw.vy,
            charge,
            aim: aimRef.current ?? undefined,
          });

          motionSamples.current = [];

          if (release.kind === 'tap') {
            stopCharge();
            interactingRef.current = false;
            onTapRef.current();
            return;
          }

          if (release.kind === 'fling') {
            if (charge >= BUBBLE_CHARGE_LAUNCH_MIN) void playBubbleThrowHaptic(charge);
            // startPhysics clears charge; keep value only for haptic above.
            startPhysicsRef.current(release.vx, release.vy);
            return;
          }

          stopCharge();
          placeHere();
        },
        onPanResponderTerminate: () => {
          clearChargeArm();
          stopPhysics();
          stopCharge();
          motionSamples.current = [];
          placeHere();
        },
      }),
    [
      armChargeOnHold,
      bubbleLayout,
      clearChargeArm,
      leftAnim,
      placeHere,
      stopCharge,
      stopPhysics,
      topAnim,
    ],
  );

  const clamped = clampBubblePosition(
    pos.x,
    pos.y,
    {
      width: layout.width,
      height: layout.height,
      topInset,
      bottomInset,
    },
    { width: chipWidth, height: chipHeight },
  );

  return {
    panHandlers: panResponder.panHandlers,
    leftAnim,
    topAnim,
    chargeProgress,
    layout,
    onLayout: (width, height) => setLayout({ width, height }),
    bubbleLeft: clamped.x * layout.width,
    bubbleTop: clamped.y * layout.height,
  };
}
