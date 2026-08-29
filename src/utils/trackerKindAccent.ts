import type { ElementKind } from '../protocol';
import type { ResolvedTheme } from '../protocol/appSettings';

export interface TrackerKindAccent {
  color: string;
}

const TRACKER_KIND_ACCENTS: Record<ResolvedTheme, Record<ElementKind, TrackerKindAccent>> = {
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

export function getTrackerKindAccent(mode: ResolvedTheme, kind: ElementKind): TrackerKindAccent {
  return TRACKER_KIND_ACCENTS[mode][kind];
}
