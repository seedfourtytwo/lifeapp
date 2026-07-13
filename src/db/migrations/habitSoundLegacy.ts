import type { HabitTimerSound } from '../../protocol/habitSound';

type LegacyHabitTimerSound = HabitTimerSound & {
  youtubeUrl?: string;
  localUri?: string;
  localLabel?: string;
};

/** Migration-only — converts legacy sound library entries to per-habit timerSound. */
export function buildLegacyHabitTimerSoundFromLibrary(input: {
  source: 'file' | 'youtube';
  uri: string;
  label?: string;
}): LegacyHabitTimerSound | undefined {
  const label = input.label?.trim() || undefined;
  if (input.source === 'youtube') {
    const youtubeUrl = normalizeYoutubeUrl(input.uri);
    if (!youtubeUrl) return undefined;
    return { youtubeUrl, ...(label ? { localLabel: label } : {}) };
  }

  const localUri = input.uri.trim();
  if (!localUri) return undefined;
  return { localUri, ...(label ? { localLabel: label } : {}) };
}

function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed) && /\d/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return id.length === 11 ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery && fromQuery.length === 11) return fromQuery;

      const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYoutubeUrl(input: string): string | undefined {
  const id = parseYoutubeVideoId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}
