import type { ThemeMode } from '../theme/types';

export function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function lerpHex(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
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
  completeText: string;
}

const COUNTER_PROGRESS_BAR: Record<ThemeMode, CounterProgressBarColors> = {
  light: { active: '#F97316', complete: '#10B981', completeText: '#059669' },
  dark: { active: '#F97316', complete: '#10B981', completeText: '#059669' },
  cartoon: { active: '#E8A317', complete: '#4A9E3F', completeText: '#2D5A24' },
};

export function getCounterProgressBarColors(mode: ThemeMode): CounterProgressBarColors {
  return COUNTER_PROGRESS_BAR[mode];
}

const COUNTER_PROGRESS_PALETTE = {
  light: { start: '#FFF7ED', end: '#ECFDF5' },
  dark: { start: '#3D2A1F', end: '#1A2E26' },
  cartoon: { start: '#FFF9E6', end: '#D4F5C4' },
} as const;

export function getCounterProgressPalette(mode: ThemeMode) {
  return COUNTER_PROGRESS_PALETTE[mode];
}
