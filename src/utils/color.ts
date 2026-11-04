import type { ResolvedTheme } from '../protocol/appSettings';
import { clamp01 } from './clamp01';

export function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function lerpHex(from: string, to: string, amount: number): string {
  const t = clamp01(amount);
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);
  const channels = [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export interface CounterProgressBarColors {
  active: string;
  complete: string;
}

/** A counter fills in a light moss while it climbs and the full moss once it is met. */
const COUNTER_PROGRESS_BAR: Record<ResolvedTheme, CounterProgressBarColors> = {
  light: { active: '#7FA893', complete: '#2E6A4E' },
  dark: { active: '#4F7A63', complete: '#86C9A3' },
};

export function getCounterProgressBarColors(mode: ResolvedTheme): CounterProgressBarColors {
  return COUNTER_PROGRESS_BAR[mode];
}

/** Append alpha (0–1) to a `#RRGGBB` color for translucent fills. */
export function withHexAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const a = Math.round(clamp01(alpha) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${a}`;
}
