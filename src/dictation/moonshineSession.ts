import {
  abortMoonshineDictation,
  addMoonshineCapturingListener,
  addMoonshineErrorListener,
  addMoonshineListeningListener,
  addMoonshinePartialListener,
  addMoonshineTakeLimitListener,
  startMoonshineDictation,
  stopMoonshineDictation,
  type EventSubscription,
} from 'life-moonshine-dictation';
import type { MoonshineDictationSession, MoonshineSessionHandlers } from './types';

function detachAll(subs: EventSubscription[]): void {
  for (const sub of subs) {
    sub.remove();
  }
}

export type MoonshineSessionStart = {
  session: MoonshineDictationSession;
  /** Opens the native mic — call after assigning `session` to a ref. */
  activate: () => Promise<void>;
};

/**
 * Wire Moonshine listeners before mic start so Done cannot race an unset ref.
 * Live events are committed phrases + a short tail — not the full take string.
 */
export function openMoonshineDictationSession(
  handlers: MoonshineSessionHandlers,
): MoonshineSessionStart {
  let closed = false;

  const subs: EventSubscription[] = [
    addMoonshineListeningListener(() => {
      if (closed) return;
      handlers.onListening();
    }),
    addMoonshinePartialListener(({ committed, tail }) => {
      if (closed) return;
      handlers.onDisplay({
        committed: committed.trim(),
        tail: tail.trim(),
      });
    }),
    addMoonshineCapturingListener(({ capturing }) => {
      if (closed) return;
      handlers.onCapturing?.(capturing);
    }),
    addMoonshineTakeLimitListener(({ reason }) => {
      if (closed) return;
      handlers.onTakeLimit?.(reason);
    }),
    addMoonshineErrorListener(({ message }) => {
      if (closed) return;
      handlers.onError(message);
    }),
  ];

  const stop = async (): Promise<string> => {
    if (closed) return '';
    closed = true;
    detachAll(subs);
    const { text } = await stopMoonshineDictation();
    handlers.onDisplay(null);
    return text.trim();
  };

  const abort = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    detachAll(subs);
    await abortMoonshineDictation();
    handlers.onDisplay(null);
  };

  const activate = async (): Promise<void> => {
    try {
      await startMoonshineDictation();
    } catch (error) {
      if (!closed) {
        closed = true;
        detachAll(subs);
      }
      throw error;
    }
  };

  return { session: { stop, abort }, activate };
}
