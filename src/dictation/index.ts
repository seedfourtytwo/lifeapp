/**
 * Safe barrel for constants/types (no native side effects on import).
 */
export {
  MOONSHINE_NOTE_STT_LOCALE,
  MOONSHINE_NOTE_STT_MODEL_LABEL,
} from './moonshineModel';
export {
  DICTATION_TAKE_MAX_CHARS,
  DICTATION_TAKE_MAX_MS,
  DICTATION_TAKE_WARN_MS,
} from './limits';
export type { DictationLivePreview } from './livePreview';
export { livePreviewLength } from './livePreview';
export type {
  DictationPrepResult,
  DictationPrepStatus,
  DictationTakeLimitReason,
} from './types';
