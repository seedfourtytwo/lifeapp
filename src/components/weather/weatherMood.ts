import type { WeatherCondition } from '../../weather/types';

export type WeatherMoodVariant = 'normal' | 'offline' | 'error';

export interface WeatherMood {
  /** Soft wash behind the face */
  fill: string;
  /** Condition-colored rim — stronger when wetter / stormier */
  border: string;
  /** Primary type / icon */
  ink: string;
  /** Secondary type */
  inkSoft: string;
  /** Border stroke weight */
  borderWidth: number;
}

interface MoodPair {
  soft: Omit<WeatherMood, 'borderWidth'>;
  hard: Omit<WeatherMood, 'borderWidth'>;
}

/** Soft → hard pairs; precip / severity pushes toward hard (esp. border). */
const MOOD_PAIRS: Record<WeatherCondition, MoodPair> = {
  sunny: {
    soft: {
      fill: '#FFF8EC',
      border: '#E8B84A',
      ink: '#5C3604',
      inkSoft: '#8A5A1A',
    },
    hard: {
      fill: '#FFE8C8',
      border: '#D4890A',
      ink: '#4A2C03',
      inkSoft: '#8A5A1A',
    },
  },
  cloudy: {
    soft: {
      fill: '#F4F6F8',
      border: '#A8B4C4',
      ink: '#1E293B',
      inkSoft: '#64748B',
    },
    hard: {
      fill: '#E4EAF0',
      border: '#6B7C90',
      ink: '#0F172A',
      inkSoft: '#475569',
    },
  },
  rain: {
    soft: {
      fill: '#F0F7FC',
      border: '#7EB8DC',
      ink: '#1A3A55',
      inkSoft: '#4A7A9B',
    },
    hard: {
      fill: '#C5DFF0',
      border: '#1565A0',
      ink: '#0A2540',
      inkSoft: '#1E5A84',
    },
  },
  storm: {
    soft: {
      fill: '#EEEDF6',
      border: '#8B7AD4',
      ink: '#2A1A5C',
      inkSoft: '#5B4DB3',
    },
    hard: {
      fill: '#C8C0E4',
      border: '#2E1F6E',
      ink: '#12083A',
      inkSoft: '#3D2D8A',
    },
  },
  snow: {
    soft: {
      fill: '#F7FAFD',
      border: '#9BB0CC',
      ink: '#1E3A5F',
      inkSoft: '#5A7394',
    },
    hard: {
      fill: '#DCE6F2',
      border: '#4A6A94',
      ink: '#0F2744',
      inkSoft: '#3D5A7A',
    },
  },
  other: {
    soft: {
      fill: '#FFF9F0',
      border: '#D4A84B',
      ink: '#4A3B18',
      inkSoft: '#8A7340',
    },
    hard: {
      fill: '#F5E6C8',
      border: '#B8860B',
      ink: '#3A2E10',
      inkSoft: '#8A7340',
    },
  },
};

const MUTED: WeatherMood = {
  fill: '#F1F5F9',
  border: '#94A3AF',
  ink: '#64748B',
  inkSoft: '#94A3AF',
  borderWidth: 1.5,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return null;
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  const u = clamp01(t);
  return rgbToHex(
    ca[0] + (cb[0] - ca[0]) * u,
    ca[1] + (cb[1] - ca[1]) * u,
    ca[2] + (cb[2] - ca[2]) * u,
  );
}

/**
 * How hard to push soft→hard. Precip drives wet conditions; storms sit higher
 * even with modest rain chance.
 */
function moodIntensity(
  condition: WeatherCondition,
  precipProbabilityPct?: number | null,
): number {
  const precip =
    precipProbabilityPct == null ? 0.35 : clamp01(precipProbabilityPct / 100);

  switch (condition) {
    case 'storm':
      return clamp01(0.55 + precip * 0.45);
    case 'rain':
      return clamp01(0.25 + precip * 0.75);
    case 'snow':
      return clamp01(0.3 + precip * 0.7);
    case 'cloudy':
      return clamp01(0.15 + precip * 0.55);
    case 'sunny':
      return clamp01(precip * 0.35);
    default:
      return clamp01(0.2 + precip * 0.4);
  }
}

export function weatherMoodFor(
  condition: WeatherCondition,
  opts?: {
    muted?: boolean;
    variant?: WeatherMoodVariant;
    precipProbabilityPct?: number | null;
  },
): WeatherMood {
  if (opts?.muted || opts?.variant === 'offline' || opts?.variant === 'error') {
    return MUTED;
  }

  const pair = MOOD_PAIRS[condition] ?? MOOD_PAIRS.other;
  const t = moodIntensity(condition, opts?.precipProbabilityPct);

  // Border tracks intensity harder than the fill so the rim reads first.
  const borderT = clamp01(t * 1.15);
  const fillT = t * 0.85;

  return {
    fill: mixHex(pair.soft.fill, pair.hard.fill, fillT),
    border: mixHex(pair.soft.border, pair.hard.border, borderT),
    ink: mixHex(pair.soft.ink, pair.hard.ink, fillT),
    inkSoft: mixHex(pair.soft.inkSoft, pair.hard.inkSoft, fillT),
    borderWidth: t >= 0.65 ? 2.25 : t >= 0.35 ? 2 : 1.5,
  };
}

/** Rain chance at or above this reads as “notable” (stronger ink). */
export const RAIN_NOTABLE_PCT = 25;
