import type { DictationLivePreview } from './livePreview';

export type { DictationLivePreview };

/** Non-error progress shown in the note sheet. */
export type DictationPrepStatus = {
  phase: 'checking' | 'progress';
  message: string;
  progress?: number;
};

export type DictationPrepResult =
  | { ready: true; locale: string }
  | { ready: false; message: string; aborted?: boolean };

export type DictationTakeLimitReason = 'characters' | 'duration';

export type MoonshineSessionHandlers = {
  onListening: () => void;
  onDisplay: (live: DictationLivePreview | null) => void;
  /** False during long pauses while the mic stays open. */
  onCapturing?: (capturing: boolean) => void;
  /** Native hit the take cap — JS should finish and commit. */
  onTakeLimit?: (reason: DictationTakeLimitReason) => void;
  onError: (message: string) => void;
};

export type MoonshineDictationSession = {
  stop: () => Promise<string>;
  abort: () => Promise<void>;
};
