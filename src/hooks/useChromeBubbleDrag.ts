import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, type GestureResponderHandlers } from 'react-native';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  clampBubblePosition,
  getBubblePixelBounds,
  type BubbleChipSize,
  type BubbleLayout,
} from '../weather/bubblePosition';
import {
  BUBBLE_FLING_THRESHOLD,
  appendMotionSample,
  clampSpeed,
  stepBubblePhysics,
  velocityFromSamples,
  type BubbleMotionSample,
} from '../weather/bubblePhysics';
import { playHabitCompleteHaptic } from '../utils/habitHaptics';

const TAP_SLOP = 8;
const LONG_PRESS_MS = 420;

interface Options {
  savedX: number;
  savedY: number;
  setBubblePosition: (x: number, y: number) => void | Promise<void>;
  topInset: number;
  /** Safe bottom inset including dock reserve. */
  bottomInset: number;
  /** Fling/bounce only when true (weather chip). Calendar-only places without physics. */
  allowFling: boolean;
  /** Hit-box used for clamping / physics (defaults to weather chip). */
  chipWidth?: number;
  chipHeight?: number;
  onTap: () => void;
  onLongPress: () => void;
  /** Collapse forecast / hide calendar chip when a real drag starts. */
  onDragStart?: () => void;
  /** DVD-corner celebration (px). Prefer a pre-mounted confetti `play()` — no React remount. */
  onCornerHit?: (x: number, y: number) => void;
}

/**
 * Drag + optional fling/bounce for the home chrome chip.
 * Uses Animated pixel values during motion so physics does not re-render React at 60fps.
 */
export function useChromeBubbleDrag({
  savedX,
  savedY,
  setBubblePosition,
  topInset,
  bottomInset,
  allowFling,
  chipWidth = BUBBLE_WIDTH,
  chipHeight = BUBBLE_HEIGHT,
  onTap,
  onLongPress,
  onDragStart,
  onCornerHit,
}: Options): {
  panHandlers: GestureResponderHandlers;
  leftAnim: Animated.Value;
  topAnim: Animated.Value;
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

  const chipRef = useRef<BubbleChipSize>({ width: chipWidth, height: chipHeight });
  chipRef.current = { width: chipWidth, height: chipHeight };

  const initialClamped = clampBubblePosition(
    savedX,
    savedY,
    {
      width: layout.width,
      height: layout.height,
      topInset,
      bottomInset,
    },
    chipRef.current,
  );
  const leftAnim = useRef(new Animated.Value(initialClamped.x * layout.width)).current;
  const topAnim = useRef(new Animated.Value(initialClamped.y * layout.height)).current;

  const layoutRef = useRef(layout);
  const insetsRef = useRef({ top: topInset, bottom: bottomInset });
  const posRef = useRef(pos);
  const dragOrigin = useRef(pos);
  const moved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const physicsRaf = useRef<number | null>(null);
  const interactingRef = useRef(false);
  const motionSamples = useRef<BubbleMotionSample[]>([]);
  const setBubblePositionRef = useRef(setBubblePosition);
  const allowFlingRef = useRef(allowFling);
  const onTapRef = useRef(onTap);
  const onLongPressRef = useRef(onLongPress);
  const onDragStartRef = useRef(onDragStart);
  const onCornerHitRef = useRef(onCornerHit);
  const startPhysicsRef = useRef<(vx: number, vy: number) => void>(() => {});

  layoutRef.current = layout;
  insetsRef.current = { top: topInset, bottom: bottomInset };
  posRef.current = pos;
  setBubblePositionRef.current = setBubblePosition;
  allowFlingRef.current = allowFling;
  onTapRef.current = onTap;
  onLongPressRef.current = onLongPress;
  onDragStartRef.current = onDragStart;
  onCornerHitRef.current = onCornerHit;

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

  const stopPhysics = useCallback(() => {
    if (physicsRaf.current != null) {
      cancelAnimationFrame(physicsRaf.current);
      physicsRaf.current = null;
    }
  }, []);

  const persist = useCallback((next: { x: number; y: number }) => {
    void setBubblePositionRef.current(next.x, next.y);
  }, []);

  startPhysicsRef.current = (vxPx: number, vyPx: number) => {
    stopPhysics();
    const layoutNow = bubbleLayout();
    const chip = chipRef.current;
    const { width, height } = layoutNow;
    if (width <= 0 || height <= 0) {
      persist(posRef.current);
      interactingRef.current = false;
      return;
    }

    const bounds = getBubblePixelBounds(layoutNow, chip);
    const speed = clampSpeed(vxPx, vyPx);
    let state = {
      x: posRef.current.x * width,
      y: posRef.current.y * height,
      vx: speed.vx,
      vy: speed.vy,
    };
    let lastTs = performance.now();
    let celebratedCorner = false;
    interactingRef.current = true;

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - lastTs) / 1000);
      lastTs = now;
      const stepped = stepBubblePhysics(state, bounds, dt);
      state = stepped.state;
      leftAnim.setValue(state.x);
      topAnim.setValue(state.y);
      posRef.current = { x: state.x / width, y: state.y / height };

      if (stepped.cornerHit && !celebratedCorner) {
        celebratedCorner = true;
        const cx = state.x + chip.width / 2;
        const cy = state.y + chip.height / 2;
        // Fire after this physics frame so confetti doesn't contend with setValue.
        requestAnimationFrame(() => {
          onCornerHitRef.current?.(cx, cy);
          void playHabitCompleteHaptic();
        });
      }

      if (stepped.settled) {
        physicsRaf.current = null;
        interactingRef.current = false;
        const clamped = clampBubblePosition(
          posRef.current.x,
          posRef.current.y,
          layoutNow,
          chip,
        );
        posRef.current = clamped;
        setPos(clamped);
        syncAnimFromNorm(clamped);
        persist(clamped);
        return;
      }
      physicsRaf.current = requestAnimationFrame(tick);
    };

    physicsRaf.current = requestAnimationFrame(tick);
  };

  // Sync from settings only when idle (avoid fighting an in-flight fling).
  useEffect(() => {
    if (interactingRef.current || physicsRaf.current != null) return;
    const clamped = clampBubblePosition(savedX, savedY, bubbleLayout(), chipRef.current);
    posRef.current = clamped;
    setPos(clamped);
    syncAnimFromNorm(clamped);
  }, [savedX, savedY, bubbleLayout, syncAnimFromNorm]);

  // Keep anim pixels correct when layout / insets / chip size change while idle.
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

  useEffect(() => () => stopPhysics(), [stopPhysics]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          stopPhysics();
          interactingRef.current = true;
          dragOrigin.current = posRef.current;
          moved.current = false;
          longPressFired.current = false;
          const { width, height } = layoutRef.current;
          motionSamples.current = [
            {
              t: Date.now(),
              x: posRef.current.x * Math.max(width, 1),
              y: posRef.current.y * Math.max(height, 1),
            },
          ];
          clearLongPress();
          longPressTimer.current = setTimeout(() => {
            if (!moved.current) {
              longPressFired.current = true;
              interactingRef.current = false;
              onLongPressRef.current();
            }
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP) {
            if (!moved.current) onDragStartRef.current?.();
            moved.current = true;
            clearLongPress();
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
          clearLongPress();
          if (longPressFired.current) return;
          if (!moved.current) {
            interactingRef.current = false;
            onTapRef.current();
            return;
          }

          const { vx, vy } = velocityFromSamples(motionSamples.current);
          motionSamples.current = [];

          if (allowFlingRef.current && Math.hypot(vx, vy) >= BUBBLE_FLING_THRESHOLD) {
            startPhysicsRef.current(vx, vy);
            return;
          }

          interactingRef.current = false;
          const clamped = clampBubblePosition(
            posRef.current.x,
            posRef.current.y,
            bubbleLayout(),
            chipRef.current,
          );
          posRef.current = clamped;
          setPos(clamped);
          syncAnimFromNorm(clamped);
          persist(clamped);
        },
        onPanResponderTerminate: () => {
          clearLongPress();
          stopPhysics();
          motionSamples.current = [];
          interactingRef.current = false;
          const clamped = clampBubblePosition(
            posRef.current.x,
            posRef.current.y,
            bubbleLayout(),
            chipRef.current,
          );
          posRef.current = clamped;
          setPos(clamped);
          syncAnimFromNorm(clamped);
          persist(clamped);
        },
      }),
    [bubbleLayout, leftAnim, persist, stopPhysics, syncAnimFromNorm, topAnim],
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
    layout,
    onLayout: (width, height) => setLayout({ width, height }),
    bubbleLeft: clamped.x * layout.width,
    bubbleTop: clamped.y * layout.height,
  };
}
