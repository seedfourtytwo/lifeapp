import type { ElementKind } from '../protocol';
import type { ThemeMode } from '../theme/types';

export interface TrackerKindAccent {
  color: string;
}

const TRACKER_KIND_ACCENTS: Record<ThemeMode, Record<ElementKind, TrackerKindAccent>> = {
  light: {
    counter: { color: '#EA580C' },
    habit: { color: '#0D9488' },
  },
  dark: {
    counter: { color: '#FB923C' },
    habit: { color: '#2DD4BF' },
  },
  cartoon: {
    counter: { color: '#C2410C' },
    habit: { color: '#5B9BD5' },
  },
};

export function getTrackerKindAccent(mode: ThemeMode, kind: ElementKind): TrackerKindAccent {
  return TRACKER_KIND_ACCENTS[mode][kind];
}
