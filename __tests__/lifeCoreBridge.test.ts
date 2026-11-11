import type { LifeCoreNativeModule } from 'life-core';
import { lifeCore, nativeLifeCore } from '../src/core/lifeCore';

const HABIT = '550e8400-e29b-41d4-a716-446655440001';

const state = {
  sessionId: '6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c12',
  trackerId: HABIT,
  name: 'Meditation',
  lockScreenName: null,
  iconKey: null,
  goal: { type: 'open' },
  trackId: null,
  loop: false,
  loggedSeconds: 0,
  startedAt: '2026-03-10T08:00:00.000Z',
  pausedAt: null,
  pausedMs: 0,
  day: '2026-03-10',
  goalReachedAt: null,
  heartbeatAt: '2026-03-10T08:00:00.000Z',
};

function moduleReturning(json: Partial<Record<keyof LifeCoreNativeModule, unknown>>) {
  const listeners: ((event: { state: string | null }) => void)[] = [];
  const module = {
    start: jest.fn(async (_requestJson: string) => json.start),
    pause: jest.fn(async () => json.pause ?? null),
    resume: jest.fn(async () => null),
    finish: jest.fn(async () => json.finish ?? null),
    discard: jest.fn(async () => undefined),
    getState: jest.fn(async () => json.getState ?? null),
    previewSound: jest.fn(async () => true),
    stopPreview: jest.fn(async () => undefined),
    addListener: jest.fn((_name: string, listener: (event: { state: string | null }) => void) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    }),
  };
  return { module: module as unknown as LifeCoreNativeModule, raw: module, listeners };
}

describe('the native core bridge', () => {
  it('sends the start request as JSON and parses the state that comes back', async () => {
    const { module, raw } = moduleReturning({ start: JSON.stringify(state) });

    const started = await nativeLifeCore(module).start({
      trackerId: HABIT,
      name: 'Meditation',
      lockScreenName: null,
      iconKey: null,
      goal: { type: 'open' },
      trackId: null,
      loop: false,
      loggedSeconds: 0,
    });

    expect(started).toEqual(state);
    expect(JSON.parse(raw.start.mock.calls[0]![0])).toMatchObject({
      trackerId: HABIT,
      goal: { type: 'open' },
    });
  });

  it('refuses a state that does not match the contract', async () => {
    const { module } = moduleReturning({ getState: JSON.stringify({ ...state, pausedMs: -1 }) });

    await expect(nativeLifeCore(module).getState()).rejects.toThrow();
  });

  it('parses the finished session record and passes the Done flag', async () => {
    const record = {
      v: 1,
      id: '6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11',
      at: '2026-03-10T08:10:00.000Z',
      day: '2026-03-10',
      type: 'timer_session',
      trackerId: HABIT,
      startedAt: '2026-03-10T08:00:00.000Z',
      endedAt: '2026-03-10T08:10:00.000Z',
      pausedMs: 0,
      activeSeconds: 600,
      goalSecondsInForce: null,
      trackCompleted: false,
      markComplete: true,
    };
    const { module, raw } = moduleReturning({ finish: JSON.stringify(record) });

    await expect(nativeLifeCore(module).finish({ markComplete: true })).resolves.toEqual(record);
    expect(raw.finish).toHaveBeenCalledWith(true);
  });

  it('hands state changes to listeners, parsed, and null when the session ends', () => {
    const { module, listeners } = moduleReturning({});
    const seen: unknown[] = [];
    nativeLifeCore(module).addStateListener((next) => seen.push(next));

    listeners[0]!({ state: JSON.stringify(state) });
    listeners[0]!({ state: null });

    expect(seen).toEqual([state, null]);
  });

  it('is the fake where the module is not built in, as in Jest', async () => {
    await expect(lifeCore.getState()).resolves.toBeNull();
    await expect(lifeCore.previewSound('meditation15min')).resolves.toBe(false);
  });
});
