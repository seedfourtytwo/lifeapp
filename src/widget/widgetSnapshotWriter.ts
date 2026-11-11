import { getDatabase } from '../db/client';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { isCounterElement, isHabitElement, shiftDateString, type DayFacts } from '../protocol';
import { WidgetSnapshotSchema } from '../protocol/widgetSnapshot';
import { loadCounterStreakMaps } from '../store/counterStreakFetch';
import { useElementStore } from '../store/elementStore';
import {
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';
import { loadHabitStreakMaps } from '../store/habitStreakFetch';
import { useUrgeStore } from '../store/urgeStore';
import { formatLampLabel } from '../utils/commitmentFormat';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { getActiveCommitment, getActiveElements } from '../utils/dashboardElements';
import { streakHistorySinceDate } from '../utils/dates';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { computeTrackerStreaks } from '../utils/trackerStreaks';
import { buildWidgetSnapshot } from './buildWidgetSnapshot';
import { replaceWidgetFile, widgetDirectory } from './widgetFiles';

export const WIDGET_SNAPSHOT_FILE = 'snapshot.json';
/** Changes inside this window after the first one share a single write. */
export const WIDGET_SNAPSHOT_DEBOUNCE_MS = 500;

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function writeSnapshotNow(): Promise<void> {
  // Never write "nothing ridden out" for counts not read yet.
  if (!useUrgeStore.getState().loaded) await useUrgeStore.getState().refresh();
  const db = await getDatabase();
  // Read in sequence: concurrent statements on one expo-sqlite connection can fail.
  const elements = await elementRepo.getAllElements(db);
  const dashboard = await dashboardRepo.getDashboardItems(db);
  const trackers = getActiveElements(elements, dashboard);
  const now = new Date();
  const today = currentAppCalendarDate(now);
  const ids = trackers.map((tracker) => tracker.id);
  const factsById = await eventRepo.getDayFactsForElementsOnDate(db, ids, today);
  const recent = await eventRepo.getDayFactsForElementsSince(db, ids, shiftDateString(today, -13));
  const recentFacts = new Map(
    [...recent].map(([id, days]) => [
      id,
      new Map<string, DayFacts>(days.map(({ date, facts }) => [date, facts])),
    ]),
  );
  const commitment = getActiveCommitment(trackers);
  const commitmentStreak = commitment
    ? computeTrackerStreaks(
        commitment,
        (
          await eventRepo.getDayFactsForElementsSince(db, [commitment.id], streakHistorySinceDate())
        ).get(commitment.id) ?? [],
        today,
        createdOnLocalDate(commitment.createdAt),
      ).streak
    : 0;
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
      recentFacts,
      habitStreaks,
      counterStreaks,
      commitmentStreak,
      sessions: useEventStore.getState().activeTimerSessions,
      urges: useUrgeStore.getState(),
      lampLabel: formatLampLabel,
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
  const unsubscribeUrges = useUrgeStore.subscribe((next, previous) => {
    if (
      next.ride !== previous.ride ||
      next.urgesToday !== previous.urgesToday ||
      next.riddenOutTotal !== previous.riddenOutTotal
    ) {
      void requestWidgetSnapshot();
    }
  });
  return () => {
    unsubscribeEvents();
    unsubscribeElements();
    unsubscribeUrges();
  };
}
