import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useReducer,
  useRef,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import type { BubbleHitEdges } from '../../weather/bubblePhysics';
import { cornerIdFromEdges } from '../../weather/bubblePhysics';
import { BUBBLE_RADIUS } from '../../weather/bubblePosition';

export interface BounceEdgeFlashHandle {
  /** Theme-colored flicker on bounce edges — L only when a corner was scored. */
  play: (hit: {
    edges: BubbleHitEdges;
    /** True only when this bounce counted as a DVD corner. */
    scoredCorner: boolean;
    chipX: number;
    chipY: number;
    chipW: number;
    chipH: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }) => void;
}

type Slot = {
  opacity: Animated.Value;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
};

interface Props {
  /** Theme outline / border color (cartoon brown, dark slate, …). */
  color: string;
}

const POOL = 8;
const THICKNESS = 3;
const FLASH_IN_MS = 40;
const FLASH_OUT_MS = 240;

/** Flat edge length — box side minus the two rounded corners. */
function flatLen(side: number, radius: number): number {
  return Math.max(THICKNESS, side - 2 * radius);
}

/**
 * Screen-edge impact flashes for the weather bubble.
 * Wall ticks align to the chip’s flat runs.
 * Scored corners draw an L that meets at the playfield corner.
 */
const BounceEdgeFlash = forwardRef<BounceEdgeFlashHandle, Props>(
  function BounceEdgeFlash({ color }, ref) {
    const colorRef = useRef(color);
    colorRef.current = color;

    const slots = useRef<Slot[]>(
      Array.from({ length: POOL }, () => ({
        opacity: new Animated.Value(0),
        left: 0,
        top: 0,
        width: THICKNESS,
        height: 72,
        color,
      })),
    ).current;
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const next = useRef(0);
    const reduceMotion = useReduceMotion();
    const reduceMotionRef = useRef(reduceMotion);
    reduceMotionRef.current = reduceMotion;

    const fireSegment = useCallback(
      (left: number, top: number, width: number, height: number) => {
        // Decorative flash on a bounce; the bounce itself is already visible.
        if (reduceMotionRef.current) return;
        const i = next.current % POOL;
        next.current += 1;
        const slot = slots[i]!;
        slot.opacity.stopAnimation();
        slot.opacity.setValue(0);
        slot.left = left;
        slot.top = top;
        slot.width = width;
        slot.height = height;
        slot.color = colorRef.current;
        bump();
        Animated.sequence([
          Animated.timing(slot.opacity, {
            toValue: 1,
            duration: FLASH_IN_MS,
            useNativeDriver: true,
          }),
          Animated.timing(slot.opacity, {
            toValue: 0,
            duration: FLASH_OUT_MS,
            useNativeDriver: true,
          }),
        ]).start();
      },
      [bump, slots],
    );

    useImperativeHandle(
      ref,
      () => ({
        play: ({ edges, scoredCorner, chipX, chipY, chipW, chipH, bounds }) => {
          const r = Math.min(BUBBLE_RADIUS, chipW / 2, chipH / 2);
          const sideLen = flatLen(chipH, r);
          const endLen = flatLen(chipW, r);

          const rimL = Math.max(0, bounds.minX - 1);
          const rimR = bounds.maxX + chipW - THICKNESS + 1;
          const rimT = Math.max(0, bounds.minY - 1);
          const rimB = bounds.maxY + chipH - THICKNESS + 1;

          // Wall ticks: sit on the chip’s flat run (stop where it curves).
          const flatTop = chipY + r;
          const flatLeft = chipX + r;

          if (scoredCorner) {
            // L meets at the playfield corner — legs are flat-run length so they touch.
            const id = cornerIdFromEdges(edges);
            if (id === 'tl') {
              fireSegment(rimL, rimT, THICKNESS, sideLen);
              fireSegment(rimL, rimT, endLen, THICKNESS);
              return;
            }
            if (id === 'tr') {
              fireSegment(rimR, rimT, THICKNESS, sideLen);
              fireSegment(rimR - endLen + THICKNESS, rimT, endLen, THICKNESS);
              return;
            }
            if (id === 'bl') {
              fireSegment(rimL, rimB - sideLen + THICKNESS, THICKNESS, sideLen);
              fireSegment(rimL, rimB, endLen, THICKNESS);
              return;
            }
            if (id === 'br') {
              fireSegment(rimR, rimB - sideLen + THICKNESS, THICKNESS, sideLen);
              fireSegment(rimR - endLen + THICKNESS, rimB, endLen, THICKNESS);
              return;
            }
            // Should not score without a clear corner — no fake L.
            return;
          }

          if (edges.left) {
            fireSegment(rimL, flatTop, THICKNESS, sideLen);
          }
          if (edges.right) {
            fireSegment(rimR, flatTop, THICKNESS, sideLen);
          }
          if (edges.top) {
            fireSegment(flatLeft, rimT, endLen, THICKNESS);
          }
          if (edges.bottom) {
            fireSegment(flatLeft, rimB, endLen, THICKNESS);
          }
        },
      }),
      [fireSegment],
    );

    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {slots.map((slot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.seg,
              {
                left: slot.left,
                top: slot.top,
                width: slot.width,
                height: slot.height,
                opacity: slot.opacity,
                backgroundColor: slot.color,
              },
            ]}
          />
        ))}
      </View>
    );
  },
);

export default BounceEdgeFlash;

const styles = StyleSheet.create({
  seg: {
    position: 'absolute',
    borderRadius: 1.5,
  },
});
