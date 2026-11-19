/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * A stopwatch the widget is running lives in `app_settings`, written from the
 * widget's own process. The app only ever reads it — here, so Today can pin
 * that habit under Now like the widget does.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../src/db/client';
import { WIDGET_TIMER_SESSIONS_KEY } from '../src/db/repositories/activeTimerRepository';
import { isRunningInWidget, useEventStore } from '../src/store/eventStore';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

const HABIT = '00000000-0000-4000-8000-000000000001';
const RUNNING = {
  startedAt: '2026-11-19T08:00:00.000Z',
  calendarDate: '2026-11-19',
  pausedAt: null,
  pauseOffsetMs: 0,
};

/** A database that holds one setting and records anything written to it. */
function dbHolding(value: string | null): { db: SQLiteDatabase; writes: string[] } {
  const writes: string[] = [];
  const db = {
    getFirstAsync: async (_sql: string, key: string) =>
      key === WIDGET_TIMER_SESSIONS_KEY && value != null ? { value } : null,
    runAsync: async (sql: string) => {
      writes.push(sql);
    },
    execAsync: async (sql: string) => {
      writes.push(sql);
    },
  } as unknown as SQLiteDatabase;
  return { db, writes };
}

describe('widget timers in the event store', () => {
  beforeEach(() => {
    useEventStore.setState({ widgetTimerSessions: {} });
  });

  it('reads what the widget is running, and writes nothing', async () => {
    const { db, writes } = dbHolding(JSON.stringify({ [HABIT]: RUNNING }));
    (getDatabase as jest.Mock).mockResolvedValue(db);

    await useEventStore.getState().loadWidgetTimerSessions();

    expect(useEventStore.getState().widgetTimerSessions).toEqual({ [HABIT]: RUNNING });
    expect(writes).toEqual([]);
  });

  it('forgets a timer the widget has stopped', async () => {
    useEventStore.setState({ widgetTimerSessions: { [HABIT]: RUNNING } });
    (getDatabase as jest.Mock).mockResolvedValue(dbHolding(null).db);

    await useEventStore.getState().loadWidgetTimerSessions();

    expect(useEventStore.getState().widgetTimerSessions).toEqual({});
  });

  it('keeps the same object when nothing changed, so nothing re-renders', async () => {
    const { db } = dbHolding(JSON.stringify({ [HABIT]: RUNNING }));
    (getDatabase as jest.Mock).mockResolvedValue(db);
    await useEventStore.getState().loadWidgetTimerSessions();
    const first = useEventStore.getState().widgetTimerSessions;

    await useEventStore.getState().loadWidgetTimerSessions();

    expect(useEventStore.getState().widgetTimerSessions).toBe(first);
  });

  it('reads garbage as no timers rather than failing', async () => {
    (getDatabase as jest.Mock).mockResolvedValue(dbHolding('{not json').db);

    await useEventStore.getState().loadWidgetTimerSessions();

    expect(useEventStore.getState().widgetTimerSessions).toEqual({});
  });

  it('is blanked with the rest of the mirror', async () => {
    useEventStore.setState({ widgetTimerSessions: { [HABIT]: RUNNING } });

    await useEventStore.getState().reset();

    expect(useEventStore.getState().widgetTimerSessions).toEqual({});
  });
});

describe('isRunningInWidget', () => {
  it('is true for a running widget timer', () => {
    expect(isRunningInWidget({ widgetTimerSessions: { [HABIT]: RUNNING } }, HABIT)).toBe(true);
  });

  it('is false once the widget holds it paused', () => {
    const paused = { ...RUNNING, pausedAt: '2026-11-19T08:05:00.000Z' };

    expect(isRunningInWidget({ widgetTimerSessions: { [HABIT]: paused } }, HABIT)).toBe(false);
  });

  it('is false for a habit the widget is not timing', () => {
    expect(isRunningInWidget({ widgetTimerSessions: {} }, HABIT)).toBe(false);
  });
});
