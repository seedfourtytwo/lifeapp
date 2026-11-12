import type {
  CoreTimerState,
  FinishOptions,
  TimerSessionRecord,
  TimerStartRequest,
} from '../protocol/coreTimer';

export interface LifeCoreSubscription {
  remove: () => void;
}

/**
 * What the app may ask of the native core. One session at a time: `start`
 * for another tracker while one exists is refused, so the caller finishes
 * the running one first and logs it.
 */
export interface LifeCore {
  /** Starts a session, or resumes this tracker's paused one, or leaves its running one alone. */
  start: (request: TimerStartRequest) => Promise<CoreTimerState>;
  pause: () => Promise<CoreTimerState | null>;
  resume: () => Promise<CoreTimerState | null>;
  /**
   * Ends the session and resolves to its record, which native has also
   * appended to the pending-actions queue; null when there was none.
   */
  finish: (options: FinishOptions) => Promise<TimerSessionRecord | null>;
  /** Ends the session and logs nothing. */
  discard: () => Promise<void>;
  getState: () => Promise<CoreTimerState | null>;
  /** Every transition, whoever made it: the app, the notification, the track's end. */
  addStateListener: (listener: (state: CoreTimerState | null) => void) => LifeCoreSubscription;
  /** The app has just replaced the widget snapshot: the widget draws from it now. */
  snapshotWritten: () => Promise<void>;
  /** The app has just replaced the reminder plan: native re-arms its alarm from it. */
  remindersChanged: () => Promise<void>;
  /** The lock-screen widget appended a tap to the pending-actions queue: time to drain. */
  addQueueListener: (listener: () => void) => LifeCoreSubscription;
  /**
   * Plays the voice note in the native core (so it plays from a locked
   * phone too), with a running timer's sound ducked under it; false when
   * there is no note.
   */
  playNote: () => Promise<boolean>;
  stopNote: () => Promise<void>;
  /** The note started or stopped playing, whoever asked. */
  addNoteListener: (listener: (playing: boolean) => void) => LifeCoreSubscription;
  /** The habit editor's preview of a bundled track; false when it cannot play. */
  previewSound: (trackId: string) => Promise<boolean>;
  stopPreview: () => Promise<void>;
}
