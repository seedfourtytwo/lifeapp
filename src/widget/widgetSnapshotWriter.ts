import { getDatabase } from '../db/client';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { isCounterElement, isHabitElement } from '../protocol';
import { WidgetSnapshotSchema } from '../protocol/widgetSnapshot';
import { loadCounterStreakMaps } from '../store/counterStreakFetch';
import { useElementStore } from '../store/elementStore';
import {
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';
import { loadHabitStreakMaps } from '../store/habitStreakFetch';
import { getActiveElements } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { buildWidgetSnapshot } from './buildWidgetSnapshot';
import { replaceWidgetFile, widgetDirectory } from './widgetFiles';

export const WIDGET_SNAPSHOT_FILE = 'snapshot.json';
/** Changes inside this window after the first one share a single write. */
export const WIDGET_SNAPSHOT_DEBOUNCE_MS = 500;

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function writeSnapshotNow(): Promise<void> {
  const db = await getDatabase();
  // Read in sequence: concurrent statements on one expo-sqlite connection can fail.
  const elements = await elementRepo.getAllElements(db);
  const dashboard = await dashboardRepo.getDashboardItems(db);
  const trackers = getActiveElements(elements, dashboard);
  const now = new Date();
  const factsById = await eventRepo.getDayFactsForElementsOnDate(
    db,
    trackers.map((tracker) => tracker.id),
    currentAppCalendarDate(now),
  );
  const { streaks: habitStreaks } = await loadHabitStreakMaps(
    habitStreakInputsFromElements(trackers.filter(isHabitElement)),
  );
  const counterStreaks = await loadCounterStreakMaps(
    counterStreakInputsFromElements(trackers.filter(isCounterElement)),
  );
  const snapshot = WidgetSnapshotSchema.parse(
    buildWidgetSnapshot({
      trackers,
      factsById,
      habitStreaks,
      counterStreaks,
      sessions: useEventStore.getState().activeTimerSessions,
      now,
      timeZone: deviceTimeZone(),
    }),
  );
  await replaceWidgetFile(WIDGET_SNAPSHOT_FILE, JSON.stringify(snapshot));
}

let pending: Promise<void> | null = null;
/** One write at a time: they share the temporary file. */
let writing: Promise<void> = Promise.resolve();

/**
 * Write the snapshot soon. Calls within the debounce window after the first
 * all resolve when that one write has landed. A failed write is logged and
 * never surfaces: the widget keeps the previous file.
 */
export function requestWidgetSnapshot(): Promise<void> {
  if (!widgetDirectory()) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve) => {
    setTimeout(() => {
      pending = null;
      writing = writing
        .then(writeSnapshotNow)
        .catch((error: unknown) => {
          console.warn('Widget snapshot not written', error);
        });
      void writing.then(resolve);
    }, WIDGET_SNAPSHOT_DEBOUNCE_MS);
  });
  return pending;
}

type EventSnapshotInputs = ReturnType<typeof useEventStore.getState>;

function eventInputsChanged(next: EventSnapshotInputs, previous: EventSnapshotInputs): boolean {
  return (
    next.dailyTotals !== previous.dailyTotals ||
    next.habitDoneToday !== previous.habitDoneToday ||
    next.habitMarkedToday !== previous.habitMarkedToday ||
    next.habitStreaks !== previous.habitStreaks ||
    next.counterStreaks !== previous.counterStreaks ||
    next.dayMapsDate !== previous.dayMapsDate ||
    next.activeTimerSessions !== previous.activeTimerSessions
  );
}

/** Rewrite the snapshot whenever something it shows changes. Returns the uninstall. */
export function installWidgetSnapshotWriter(): () => void {
  const unsubscribeEvents = useEventStore.subscribe((next, previous) => {
    if (eventInputsChanged(next, previous)) void requestWidgetSnapshot();
  });
  const unsubscribeElements = useElementStore.subscribe((next, previous) => {
    if (next.elements !== previous.elements || next.dashboard !== previous.dashboard) {
      void requestWidgetSnapshot();
    }
  });
  return () => {
    unsubscribeEvents();
    unsubscribeElements();
  };
}
