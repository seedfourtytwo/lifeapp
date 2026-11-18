import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { isLifeWidgetAvailable, requestWidgetUpdate } from 'life-widget';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useTodoStore } from '../store/todoStore';

/** A burst of taps or a reload costs one widget redraw. */
export const WIDGET_SYNC_DEBOUNCE_MS = 400;

export interface DebouncedRequest {
  /** (Re)start the quiet period; the request fires once it elapses. */
  schedule: () => void;
  /** Fire now if a request is pending. */
  flush: () => void;
  cancel: () => void;
}

/** Trailing-edge debounce around `request`. Pure, so the timing is testable with fake timers. */
export function createDebouncedRequest(
  request: () => void,
  delayMs = WIDGET_SYNC_DEBOUNCE_MS,
): DebouncedRequest {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    timer = null;
    request();
  };
  return {
    schedule: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, delayMs);
    },
    flush: () => {
      if (!timer) return;
      clearTimeout(timer);
      fire();
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** Android with the native module linked; a dev client built without it must not crash. */
export function shouldSyncWidget(os: string = Platform.OS, available = isLifeWidgetAvailable()): boolean {
  return os === 'android' && available;
}

/**
 * Keeps the home-screen widget in step with what the app writes.
 *
 * App → widget only: the widget reads SQLite itself, in its own process, so
 * all this does is ask it to redraw after the element, event or todo store
 * changes. Like the reminder syncs it reads the stores through `subscribe`,
 * off the render path. Widget → app needs nothing here: the app reloads today
 * on return to the foreground when another connection has written.
 */
export function useWidgetSync(): void {
  useEffect(() => {
    if (!shouldSyncWidget()) return;

    const debounced = createDebouncedRequest(requestWidgetUpdate);
    debounced.schedule();

    const unsubscribes = [
      useElementStore.subscribe(debounced.schedule),
      useEventStore.subscribe(debounced.schedule),
      useTodoStore.subscribe(debounced.schedule),
    ];

    // Leaving the app is when the home screen is about to show: draw now.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') debounced.flush();
    });

    return () => {
      debounced.cancel();
      for (const unsubscribe of unsubscribes) unsubscribe();
      appStateSub.remove();
    };
  }, []);
}
