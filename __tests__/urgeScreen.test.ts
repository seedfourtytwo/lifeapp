/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';

/**
 * The urge screen through the real urge store, timer controls and fake
 * native core, into a real SQLite, on a fake clock: the ten minutes it
 * carries him through, and each way they end.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);
// The commitment card finds the stack itself; the screen is handed it.
const mockCardNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockCardNavigation,
}));

/** Tuesday 10 March 2026, 21:00 local. */
const NOW = new Date(2026, 2, 10, 21, 0);
const COMMITMENT = '550e8400-e29b-41d4-a716-446655441501';

let testDb: TestDb;
let mounted: ReactTestRenderer | null = null;
let navigation: { goBack: jest.Mock; canGoBack: jest.Mock; navigate: jest.Mock };
// Loaded after resetModules(), so the screen and the renderer share one React.
let React: typeof import('react');
let TestRenderer: typeof import('react-test-renderer');
/** The renderer's `act`, always awaited. */
async function act(work: () => unknown): Promise<void> {
  await TestRenderer.act(async () => {
    await work();
  });
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  React = require('react') as typeof import('react');
  TestRenderer = require('react-test-renderer') as typeof import('react-test-renderer');
  mockFs = createFakeFileSystem();
  fs.mkdirSync(`${mockFs.root}/widget`, { recursive: true });
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await seedRealisticTrackers(testDb.db);
  navigation = { goBack: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn() };
  mockCardNavigation.navigate.mockClear();
});

afterEach(async () => {
  if (mounted) await act(() => mounted!.unmount());
  mounted = null;
  jest.useRealTimers();
  testDb.raw.close();
  mockFs.cleanup();
});

async function addCommitment(config: { ownLines?: string[]; insteadHabitIds?: string[] }): Promise<void> {
  const protocol = require('../src/protocol') as typeof import('../src/protocol');
  const elementRepo = require('../src/db/repositories/elementRepository') as typeof import('../src/db/repositories/elementRepository');
  await elementRepo.insertElementWithDashboardItem(
    testDb.db,
    {
      id: COMMITMENT,
      kind: 'commitment',
      name: 'Clear',
      config: protocol.CommitmentConfigSchema.parse({
        clearSince: new Date(2026, 2, 9, 9, 0).toISOString(),
        ...config,
      }),
      protocolVersion: protocol.PROTOCOL_VERSION,
      createdAt: '2026-03-01T08:00:00.000Z',
      archivedAt: null,
    },
    { id: '550e8400-e29b-41d4-a716-446655441502', elementId: COMMITMENT, sortOrder: 99 },
  );
  await (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState().load();
}

function urges() {
  return (require('../src/store/urgeStore') as typeof import('../src/store/urgeStore')).useUrgeStore.getState();
}

function urgeRows(): Record<string, unknown>[] {
  return testDb.raw.prepare('SELECT * FROM urges ORDER BY at').all() as Record<string, unknown>[];
}

/** Let promises started by a press or a timer land. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render(): Promise<ReactTestInstance> {
  const { SafeAreaProvider } = require('react-native-safe-area-context') as typeof import('react-native-safe-area-context');
  const UrgeScreen = (require('../src/screens/UrgeScreen') as typeof import('../src/screens/UrgeScreen')).default;
  await act(async () => {
    mounted = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 900 },
            insets: { top: 24, left: 0, right: 0, bottom: 24 },
          },
        },
        React.createElement(UrgeScreen, {
          navigation,
          route: { key: 'urge', name: 'Urge' },
        } as never),
      ),
    );
  });
  await flush();
  return mounted!.root;
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

function texts(root: ReactTestInstance): string[] {
  return root
    .findAll((node) => typeof node.type === 'string' && typeof node.props.children === 'string')
    .map((node) => node.props.children as string);
}

function pressable(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onClick === 'function',
  )[0];
}

async function press(root: ReactTestInstance, label: string): Promise<void> {
  const found = pressable(root, label);
  if (!found) throw new Error(`nothing to press labelled "${label}"; texts: ${texts(root).join(' | ')}`);
  await act(async () => {
    (found.props.onClick as () => void)();
  });
  await flush();
}

describe('the urge screen', () => {
  it('counts down to the lamp with his line and one button per instead-habit', async () => {
    await addCommitment({ ownLines: ['I sleep better now'], insteadHabitIds: [TRACKERS.meditation, TRACKERS.breathing] });
    await urges().logUrge();
    const root = await render();

    expect(texts(root)).toEqual(
      expect.arrayContaining(['Ride it to the lamp', '10:00', 'I sleep better now', '15 min · Meditation', '5 min · Breathing', 'I used']),
    );

    await advance(198_000);
    expect(texts(root)).toContain('06:42');
  });

  it('puts the car on the road where the clock says', async () => {
    const { Circle } = require('react-native-svg') as typeof import('react-native-svg');
    const scene = require('../src/ui/roadScene') as typeof import('../src/ui/roadScene');
    await addCommitment({});
    await urges().logUrge();
    const root = await render();
    const carY = () => root.findAllByType(Circle).at(-1)!.props.cy as number;

    expect(carY()).toBeCloseTo(scene.roadScene({ carAt: scene.rideCarAt(0) }).tailLights[1].cy);
    await advance(300_000);
    expect(carY()).toBeCloseTo(scene.roadScene({ carAt: scene.rideCarAt(0.5) }).tailLights[1].cy);
  });

  it('starts an instead-habit in one tap and shows its timer, staying on the screen', async () => {
    await addCommitment({ insteadHabitIds: [TRACKERS.meditation, TRACKERS.breathing] });
    await urges().logUrge();
    const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');
    const root = await render();

    await press(root, 'Start Meditation');

    expect(await lifeCore.getState()).toMatchObject({ trackerId: TRACKERS.meditation, pausedAt: null });
    expect(texts(root)).toEqual(expect.arrayContaining(['Meditation', '0:00', 'of 15:00', 'I used']));
    expect(pressable(root, 'Pause timer')).toBeDefined();
    expect(pressable(root, 'Finish timer session')).toBeDefined();
    expect(pressable(root, 'Start Breathing')).toBeUndefined();
    expect(navigation.goBack).not.toHaveBeenCalled();

    await advance(60_000);
    expect(texts(root)).toContain('1:00');
    await press(root, 'Pause timer');
    expect(await lifeCore.getState()).toMatchObject({ trackerId: TRACKERS.meditation, pausedAt: expect.any(String) });
    expect(pressable(root, 'Resume timer')).toBeDefined();
  });

  it('ends the ride when the timer ends, if that is after the lamp', async () => {
    await addCommitment({ insteadHabitIds: [TRACKERS.meditation] });
    await urges().logUrge();
    const root = await render();
    await press(root, 'Start Meditation');

    await advance(600_000);
    // The ride is counted, but the timer still runs: the screen carries on with it.
    expect(urgeRows()[0]).toMatchObject({ outcome: 'rode_out' });
    expect(texts(root)).not.toContain('Ridden out.');
    expect(texts(root)).toContain('00:00');
    expect(pressable(root, 'I used: end this ride')).toBeUndefined();

    await press(root, 'Finish timer session');
    expect(texts(root)).toEqual(expect.arrayContaining(['Ridden out.', "That's 1."]));
  });

  it('says plainly that a ride left alone was ridden out, and the running total', async () => {
    await addCommitment({});
    await urges().logUrge();
    jest.setSystemTime(new Date(NOW.getTime() + 3_600_000));
    await urges().refresh();
    jest.setSystemTime(NOW.getTime() + 7_200_000);
    await urges().logUrge();
    const root = await render();

    await advance(600_000);

    expect(texts(root)).toEqual(expect.arrayContaining(['Ridden out.', "That's 2."]));
    expect(texts(root)).not.toContain('Ride it to the lamp');
    await press(root, 'Done');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('logs "I used" in one tap, then lets the question be skipped', async () => {
    await addCommitment({ ownLines: ['I sleep better now'] });
    const id = await urges().logUrge();
    const root = await render();
    await advance(120_000);

    await press(root, 'I used: end this ride');

    expect(urgeRows()[0]).toMatchObject({ id, outcome: 'used', note: null });
    expect(texts(root)).toContain('What led to it?');
    expect(texts(root)).not.toContain('I sleep better now');
    expect(navigation.goBack).not.toHaveBeenCalled();
    await press(root, 'Skip');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(urgeRows()[0]).toMatchObject({ outcome: 'used', note: null });
  });

  it('keeps what led to it when he writes a line and saves', async () => {
    await addCommitment({});
    await urges().logUrge();
    const root = await render();
    await press(root, 'I used: end this ride');

    const field = root.findAll((node) => node.props.accessibilityLabel === 'What led to it?' && typeof node.props.onChangeText === 'function')[0]!;
    await act(async () => {
      (field.props.onChangeText as (text: string) => void)('Long day');
    });
    await press(root, 'Save');

    expect(urgeRows()[0]).toMatchObject({ outcome: 'used', note: 'Long day' });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(texts(root)).not.toContain('Ridden out.');
  });

  it('offers his voice note only when there is one, and plays it in the native core', async () => {
    await addCommitment({});
    await urges().logUrge();
    let root = await render();
    expect(pressable(root, 'Play my note')).toBeUndefined();
    await act(() => mounted!.unmount());

    fs.writeFileSync(`${mockFs.root}/widget/voice-note.m4a`, 'note');
    root = await render();
    const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');
    const played = jest.spyOn(lifeCore, 'playNote');
    await press(root, 'Play my note');
    expect(played).toHaveBeenCalledTimes(1);

    await press(root, 'Stop my note');
    expect(pressable(root, 'Play my note')).toBeDefined();
  });

  it('shows nothing in place of a missing own line or instead-habit', async () => {
    await addCommitment({ ownLines: [], insteadHabitIds: [] });
    await urges().logUrge();
    const root = await render();

    expect(texts(root).sort()).toEqual(['10:00', 'I used', 'Ride it to the lamp'].sort());
  });

  it('closes when the urge was settled elsewhere, as used', async () => {
    await addCommitment({});
    const id = await urges().logUrge();
    const root = await render();
    await advance(60_000);

    await act(async () => {
      await urges().resolveUrge(id!, 'used');
    });
    await flush();

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(texts(root)).not.toContain('Ridden out.');
  });

  it('leaves the ride running when closed', async () => {
    await addCommitment({});
    await urges().logUrge();
    const root = await render();

    await press(root, 'Close. The ride keeps going.');

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(urges().ride).not.toBeNull();
    expect(urgeRows()[0]).toMatchObject({ outcome: null });
  });

  it('closes at once when there is no ride to carry', async () => {
    await addCommitment({});
    await render();

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('coming back to the app during a ride', () => {
  it('applies an urge the widget queued first, then opens its ride', async () => {
    await addCommitment({ ownLines: ['I sleep better now'] });
    const at = new Date(NOW.getTime() - 120_000);
    fs.appendFileSync(
      `${mockFs.root}/widget/pending-actions.jsonl`,
      `${JSON.stringify({ v: 1, id: '550e8400-e29b-41d4-a716-446655441503', at: at.toISOString(), day: '2026-03-10', type: 'urge_logged' })}\n`,
    );
    const { openRideIfRunning } = require('../src/hooks/useRefreshFromDb') as typeof import('../src/hooks/useRefreshFromDb');
    const open = jest.fn();

    await act(async () => {
      await openRideIfRunning(open);
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(urgeRows()).toEqual([expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655441503', source: 'widget' })]);
    const root = await render();
    expect(texts(root)).toEqual(expect.arrayContaining(['08:00', 'I sleep better now']));
  });

  it('opens nothing when no ride is running', async () => {
    const { openRideIfRunning } = require('../src/hooks/useRefreshFromDb') as typeof import('../src/hooks/useRefreshFromDb');
    const open = jest.fn();

    await act(async () => {
      await openRideIfRunning(open);
    });

    expect(open).not.toHaveBeenCalled();
  });
});

describe('the commitment card', () => {
  async function renderCard(onOfferUndo: jest.Mock = jest.fn()): Promise<ReactTestInstance> {
    const { PaperProvider } = require('react-native-paper') as typeof import('react-native-paper');
    const CommitmentCard = (require('../src/screens/habits/CommitmentCard') as typeof import('../src/screens/habits/CommitmentCard')).default;
    const { useElementStore } = require('../src/store/elementStore') as typeof import('../src/store/elementStore');
    const commitment = useElementStore.getState().elements.find((element) => element.id === COMMITMENT);
    if (commitment?.kind !== 'commitment') throw new Error('no commitment');
    await act(() => {
      mounted = TestRenderer.create(
        React.createElement(PaperProvider, null, React.createElement(CommitmentCard, { commitment, onOfferUndo })),
      );
    });
    await flush();
    return mounted!.root;
  }

  it('offers Undo after a slip, which puts clear-since back', async () => {
    await addCommitment({});
    const elementStore = (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore;
    const clearSince = () => {
      const found = elementStore.getState().elements.find((element) => element.id === COMMITMENT);
      return found?.kind === 'commitment' ? found.config.clearSince : null;
    };
    const before = clearSince();
    const { Alert } = require('react-native') as typeof import('react-native');
    const alert = jest.spyOn(Alert, 'alert');
    const offerUndo = jest.fn();
    const root = await renderCard(offerUndo);
    const { CommitmentWidget } = require('../src/kinds/commitment/CommitmentWidget') as typeof import('../src/kinds/commitment/CommitmentWidget');

    await act(() => (root.findByType(CommitmentWidget).props.onLogSlip as () => void)());
    await act(() => alert.mock.calls[0]![2]!.find((button) => button.text === 'Log it')!.onPress!());
    await flush();
    expect(clearSince()).not.toBe(before);

    expect(offerUndo).toHaveBeenCalledWith('Slip logged', expect.any(Function));
    await act(() => (offerUndo.mock.calls[0]![1] as () => Promise<void>)());
    expect(clearSince()).toBe(before);
  });

  it('logs the urge at once, then opens its ride', async () => {
    await addCommitment({});
    const root = await renderCard();

    await press(root, 'Log an urge');

    expect(urgeRows()).toEqual([expect.objectContaining({ outcome: null, source: 'app' })]);
    expect(mockCardNavigation.navigate).toHaveBeenCalledWith('Urge');
  });

  it('shows only the time left of a running ride, and returns to it when pressed', async () => {
    await addCommitment({ insteadHabitIds: [TRACKERS.meditation] });
    await urges().logUrge();
    const root = await renderCard();

    expect(pressable(root, 'Log an urge')).toBeUndefined();
    expect(pressable(root, 'Start Meditation')).toBeUndefined();
    await press(root, '10:00 left in the ride. Open it');

    expect(mockCardNavigation.navigate).toHaveBeenCalledWith('Urge');
  });
});
