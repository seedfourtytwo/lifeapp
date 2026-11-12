import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

/**
 * The Android side of the native core. Requests and states cross the bridge
 * as JSON text so Kotlin reads and writes them with the same code it uses for
 * `timer.json`; `src/core/lifeCore.ts` parses them with Zod.
 */
type LifeCoreEvents = {
  /** Every timer transition; `state` is null when no session exists. */
  onStateChange: (event: { state: string | null }) => void;
  /** The widget appended a line to the pending-actions queue. */
  onQueueChange: () => void;
  /** The voice note started or stopped playing. */
  onNoteChange: (event: { playing: boolean }) => void;
};

export declare class LifeCoreNativeModule extends NativeModule<LifeCoreEvents> {
  start(requestJson: string): Promise<string>;
  pause(): Promise<string | null>;
  resume(): Promise<string | null>;
  finish(markComplete: boolean): Promise<string | null>;
  discard(): Promise<void>;
  getState(): Promise<string | null>;
  /** The widget snapshot was just replaced; the widget redraws from it. */
  snapshotWritten(): Promise<void>;
  /** The reminder plan was just replaced; native re-arms the next reminder from it. */
  remindersChanged(): Promise<void>;
  /** Plays `files/widget/voice-note.m4a` in the native core; false when there is none. */
  playNote(): Promise<boolean>;
  stopNote(): Promise<void>;
  previewSound(trackId: string): Promise<boolean>;
  stopPreview(): Promise<void>;
}

/** Null where the module is not built in (web, Jest, an older dev client). */
export function loadLifeCoreModule(): LifeCoreNativeModule | null {
  return requireOptionalNativeModule<LifeCoreNativeModule>('LifeCore');
}
