import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BUBBLE_HEIGHT, BUBBLE_RADIUS, BUBBLE_WIDTH } from '../../weather/bubblePosition';

interface Props {
  /** 0..1 charge progress. */
  progress: number;
  /** Same color as the idle chip border. */
  color: string;
  /** Match the idle mood border thickness. */
  strokeWidth?: number;
  width?: number;
  height?: number;
  radius?: number;
}

/** Clockwise rounded-rect path starting at top-center (12 o'clock). */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + w / 2} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    `H ${x + w / 2}`,
  ].join(' ');
}

export function roundedRectPerimeter(w: number, h: number, r: number): number {
  const rr = Math.min(r, w / 2, h / 2);
  return 2 * (w + h - 2 * rr) + 2 * Math.PI * rr;
}

/** Point along the same rounded-rect path used for the meter (t in 0..1). */
function pointOnRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  t: number,
): { x: number; y: number } {
  const rr = Math.min(r, w / 2, h / 2);
  const straightW = Math.max(0, w - 2 * rr);
  const straightH = Math.max(0, h - 2 * rr);
  const arc = (Math.PI / 2) * rr;
  const peri = 2 * (straightW + straightH) + 4 * arc;
  let d = ((t % 1) + 1) % 1 * peri;

  // Top edge (mid → right)
  const topHalf = straightW / 2;
  if (d <= topHalf) return { x: x + w / 2 + d, y };
  d -= topHalf;
  // Top-right corner
  if (d <= arc) {
    const a = -Math.PI / 2 + d / rr;
    return { x: x + w - rr + Math.cos(a) * rr, y: y + rr + Math.sin(a) * rr };
  }
  d -= arc;
  // Right edge
  if (d <= straightH) return { x: x + w, y: y + rr + d };
  d -= straightH;
  // Bottom-right
  if (d <= arc) {
    const a = 0 + d / rr;
    return { x: x + w - rr + Math.cos(a) * rr, y: y + h - rr + Math.sin(a) * rr };
  }
  d -= arc;
  // Bottom edge
  if (d <= straightW) return { x: x + w - rr - d, y: y + h };
  d -= straightW;
  // Bottom-left
  if (d <= arc) {
    const a = Math.PI / 2 + d / rr;
    return { x: x + rr + Math.cos(a) * rr, y: y + h - rr + Math.sin(a) * rr };
  }
  d -= arc;
  // Left edge
  if (d <= straightH) return { x, y: y + h - rr - d };
  d -= straightH;
  // Top-left
  if (d <= arc) {
    const a = Math.PI + d / rr;
    return { x: x + rr + Math.cos(a) * rr, y: y + rr + Math.sin(a) * rr };
  }
  d -= arc;
  // Top edge (left → mid)
  return { x: x + rr + d, y };
}

/**
 * Charge meter: border arc + soft bloom + bright head so fill reads at a glance.
 */
export default function BubbleChargeRing({
  progress,
  color,
  strokeWidth = 2.25,
  width = BUBBLE_WIDTH,
  height = BUBBLE_HEIGHT,
  radius = BUBBLE_RADIUS,
}: Props) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.02) return null;

  const stroke = Math.max(2, strokeWidth);
  const glowStroke = stroke + 5;
  const inset = glowStroke / 2 + 0.5;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const innerR = Math.max(0, radius - inset);
  const peri = roundedRectPerimeter(innerW, innerH, innerR);
  const d = roundedRectPath(inset, inset, innerW, innerH, innerR);
  const dash = `${peri * p} ${peri}`;
  const head = pointOnRoundedRect(inset, inset, innerW, innerH, innerR, p);
  const headR = 2.2 + 1.4 * p;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Path d={d} stroke={color} strokeWidth={stroke} strokeOpacity={0.18} fill="none" />
        <Path
          d={d}
          stroke={color}
          strokeWidth={glowStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={dash}
          strokeOpacity={0.28 + 0.28 * p}
        />
        <Path
          d={d}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={dash}
          strokeOpacity={0.95}
        />
        {/* Bright head of the progress — draws the eye along the fill. */}
        <Circle
          cx={head.x}
          cy={head.y}
          r={headR + 2.5}
          fill={color}
          opacity={0.22 + 0.18 * p}
        />
        <Circle cx={head.x} cy={head.y} r={headR} fill={color} opacity={0.95} />
      </Svg>
    </View>
  );
}
