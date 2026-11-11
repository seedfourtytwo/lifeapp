import { createFakeLifeCore } from '../src/core/fakeLifeCore';
import type { LifeCore } from '../src/core/lifeCoreTypes';
import {
  CoreTimerStateSchema,
  TimerSessionRecordSchema,
  type CoreTimerState,
  type TimerStartRequest,
} from '../src/protocol/coreTimer';

const T0 = new Date(2026, 2, 10, 8, 0).getTime();
const HABIT = '550e8400-e29b-41d4-a716-446655440001';
const OTHER = '550e8400-e29b-41d4-a716-446655440002';

function request(overrides: Partial<TimerStartRequest> = {}): TimerStartRequest {
  return {
    trackerId: HABIT,
    name: 'Meditation',
    lockScreenName: 'Sit',
    iconKey: 'meditation',
    goal: { type: 'seconds', seconds: 900 },
    trackId: 'meditation15min',
    loop: true,
    loggedSeconds: 0,
    ...overrides,
  };
}

function setup(): { core: LifeCore; advance: (ms: number) => void; seen: (CoreTimerState | null)[] } {
  let now = T0;
  const core = createFakeLifeCore(() => now);
  const seen: (CoreTimerState | null)[] = [];
  core.addStateListener((state) => seen.push(state));
  return { core, advance: (ms) => (now += ms), seen };
}

describe('the fake native core', () => {
  it('starts a session that parses as the native state and tells listeners', async () => {
    const { core, seen } = setup();

    const state = await core.start(request());

    expect(CoreTimerStateSchema.parse(state)).toEqual(state);
    expect(state).toMatchObject({
      trackerId: HABIT,
      startedAt: new Date(T0).toISOString(),
      pausedAt: null,
      pausedMs: 0,
      day: '2026-03-10',
      goalReachedAt: null,
    });
    expect(seen).toEqual([state]);
    await expect(core.getState()).resolves.toEqual(state);
  });

  it('counts a pause, and a second start of the same tracker resumes it', async () => {
    const { core, advance } = setup();
    await core.start(request());
    advance(60_000);
    const paused = await core.pause();
    advance(30_000);
    const resumed = await core.start(request());

    expect(paused?.pausedAt).toBe(new Date(T0 + 60_000).toISOString());
    expect(resumed).toMatchObject({ pausedAt: null, pausedMs: 30_000 });
  });

  it('leaves a running session alone when it is started again', async () => {
    const { core, advance, seen } = setup();
    const first = await core.start(request());
    advance(5_000);

    await expect(core.start(request())).resolves.toEqual(first);
    expect(seen).toHaveLength(1);
  });

  it('refuses a second tracker while one session exists', async () => {
    const { core } = setup();
    await core.start(request());

    await expect(core.start(request({ trackerId: OTHER }))).rejects.toThrow(/already running/);
  });

  it('finishes a running session into a queue record and clears the state', async () => {
    const { core, advance, seen } = setup();
    await core.start(request());
    advance(10_000);
    await core.pause();
    advance(5_000);
    await core.resume();
    advance(50_500);

    const record = await core.finish({ markComplete: true });

    expect(TimerSessionRecordSchema.parse(record)).toEqual(record);
    expect(record?.id).toBe(seen[0]?.sessionId);
    expect(record).toMatchObject({
      type: 'timer_session',
      trackerId: HABIT,
      startedAt: new Date(T0).toISOString(),
      endedAt: new Date(T0 + 65_500).toISOString(),
      at: new Date(T0 + 65_500).toISOString(),
      day: '2026-03-10',
      pausedMs: 5_000,
      activeSeconds: 60,
      goalSecondsInForce: 900,
      trackCompleted: false,
      markComplete: true,
    });
    expect(seen.at(-1)).toBeNull();
    await expect(core.getState()).resolves.toBeNull();
  });

  it('ends a paused session at its pause, so the time since is not counted', async () => {
    const { core, advance } = setup();
    await core.start(request({ goal: { type: 'open' } }));
    advance(120_000);
    await core.pause();
    advance(3_600_000);

    const record = await core.finish({ markComplete: false });

    expect(record).toMatchObject({
      endedAt: new Date(T0 + 120_000).toISOString(),
      at: new Date(T0 + 3_720_000).toISOString(),
      pausedMs: 0,
      activeSeconds: 120,
      goalSecondsInForce: null,
      markComplete: false,
    });
  });

  it('has nothing to finish, pause or resume without a session', async () => {
    const { core } = setup();

    await expect(core.finish({ markComplete: true })).resolves.toBeNull();
    await expect(core.pause()).resolves.toBeNull();
    await expect(core.resume()).resolves.toBeNull();
  });

  it('discards a session without a record', async () => {
    const { core, seen } = setup();
    await core.start(request());

    await core.discard();

    await expect(core.getState()).resolves.toBeNull();
    expect(seen.at(-1)).toBeNull();
    await expect(core.finish({ markComplete: false })).resolves.toBeNull();
  });

  it('stops telling a listener once it is removed', async () => {
    let now = T0;
    const core = createFakeLifeCore(() => now);
    const seen: unknown[] = [];
    const subscription = core.addStateListener((state) => seen.push(state));
    subscription.remove();
    now += 1;

    await core.start(request());

    expect(seen).toEqual([]);
  });

  it('cannot preview sounds: they live in the Android resources', async () => {
    const { core } = setup();

    await expect(core.previewSound('meditation15min')).resolves.toBe(false);
  });
});
