import type { ElementKind } from '../protocol';
import type { ResolvedTheme } from '../protocol/appSettings';

export interface TrackerKindAccent {
  color: string;
}

/** Habits wear the moss, counters the notebook amber: two hues, both from the palette. */
const TRACKER_KIND_ACCENTS: Record<ResolvedTheme, Record<ElementKind, TrackerKindAccent>> = {
  light: {
    counter: { color: '#9A5B00' },
    habit: { color: '#2E6A4E' },
  },
  dark: {
    counter: { color: '#F0B85A' },
    habit: { color: '#86C9A3' },
  },
};

export function getTrackerKindAccent(mode: ResolvedTheme, kind: ElementKind): TrackerKindAccent {
  return TRACKER_KIND_ACCENTS[mode][kind];
}
