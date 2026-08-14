import {
  addMoonshineDownloadProgressListener,
  deleteLegacySpeechModels,
  prepareMoonshineDictation,
  warmMoonshineDictation,
} from 'life-moonshine-dictation';
import { DICTATION_MSG } from './messages';
import { MOONSHINE_NOTE_STT_LOCALE } from './moonshineModel';
import type { DictationPrepResult, DictationPrepStatus } from './types';

let legacyCleanupScheduled = false;
let modelReady = false;

function scheduleLegacyCleanupOnce(): void {
  if (legacyCleanupScheduled) return;
  legacyCleanupScheduled = true;
  void deleteLegacySpeechModels();
}

export type EnsureMoonshineOptions = {
  onStatus?: (status: DictationPrepStatus) => void;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return (
    Boolean(signal?.aborted) ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.message === 'aborted'))
  );
}

/**
 * Ensure the Moonshine Small Streaming pack is on disk and loaded.
 * Fully offline after the first successful fetch.
 */
export async function ensureMoonshineDictationReady(
  opts: EnsureMoonshineOptions = {},
): Promise<DictationPrepResult> {
  const { onStatus, signal } = opts;

  try {
    throwIfAborted(signal);

    if (modelReady) {
      scheduleLegacyCleanupOnce();
      return { ready: true, locale: MOONSHINE_NOTE_STT_LOCALE };
    }

    onStatus?.({ phase: 'checking', message: DICTATION_MSG.checkingModel });

    const progressSub = addMoonshineDownloadProgressListener(({ fraction }) => {
      const progress = Math.max(0, Math.min(100, Math.round(fraction * 100)));
      onStatus?.({
        phase: 'progress',
        progress,
        message: DICTATION_MSG.downloadProgress(MOONSHINE_NOTE_STT_LOCALE, progress),
      });
    });

    try {
      await prepareMoonshineDictation();
    } finally {
      progressSub.remove();
    }
    throwIfAborted(signal);

    scheduleLegacyCleanupOnce();
    modelReady = true;

    return { ready: true, locale: MOONSHINE_NOTE_STT_LOCALE };
  } catch (error) {
    if (isAbortError(error, signal)) {
      return { ready: false, message: '', aborted: true };
    }
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 120)
        : '';
    return {
      ready: false,
      message: detail
        ? DICTATION_MSG.downloadFailedDetail(detail)
        : DICTATION_MSG.downloadFailed,
    };
  }
}

/** Warm the model while the note sheet is visible — best-effort, may no-op. */
export async function preloadMoonshineDictation(signal?: AbortSignal): Promise<void> {
  try {
    throwIfAborted(signal);
    await warmMoonshineDictation();
  } catch (error) {
    if (isAbortError(error, signal)) return;
  }
}
