/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * Today, rendered: the model's order reaches the screen, the headings follow
 * the widget's rule, and the header row is the same under the spinner as it is
 * once the data lands.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

// Nothing here reads SQLite: the stores are seeded, and the glances that query
// it (the note icons) are written to stay empty when it fails.
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => {
    throw new Error('no database in this test');
  }),
}));
jest.mock('../src/hooks/useHabitDataRefresh', () => ({ useRefreshHabitDayOnFocus: () => {} }));
jest.mock('../src/hooks/useCounterDataRefresh', () => ({
  useRefreshCounterTotalsOnFocus: () => {},
}));

import '../src/i18n';
import {
  PROTOCOL_VERSION,
  TodoSchema,
  createActiveTimerSession,
  toDateString,
  type ElementDefinition,
  type Todo,
} from '../src/protocol';
import TodayScreen from '../src/screens/TodayScreen';
import { useElementStore } from '../src/store/elementStore';
import { useEventStore } from '../src/store/eventStore';
import { useTodoStore } from '../src/store/todoStore';

const TODAY = toDateString(new Date());

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

function element(kind: 'habit' | 'counter', name: string, config = {}): ElementDefinition {
  return {
    id: uuid(),
    kind,
    name,
    config,
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function todo(title: string, overrides: Partial<Todo> = {}): Todo {
  seq += 1;
  return TodoSchema.parse({
    id: uuid(),
    title,
    sortOrder: seq,
    createdAt: '2026-01-01T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

function seedElements(elements: ElementDefinition[]): void {
  useElementStore.setState({
    elements,
    dashboard: elements.map((item, index) => ({
      id: uuid(),
      elementId: item.id,
      sortOrder: index,
    })),
    isLoading: false,
    isLoaded: true,
    error: null,
  });
}

type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

/** Every string the page shows, in reading order. */
function texts(node: Node | Node[], found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) texts(child, found);
    return found;
  }
  if (node == null) return found;
  if (typeof node === 'string') {
    found.push(node);
    return found;
  }
  for (const child of node.children ?? []) texts(child, found);
  return found;
}

function labels(node: Node | Node[], found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) labels(child, found);
    return found;
  }
  if (node == null || typeof node === 'string') return found;
  const label = node.props?.accessibilityLabel;
  if (typeof label === 'string') found.push(label);
  for (const child of node.children ?? []) labels(child, found);
  return found;
}

async function mountToday(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 800 },
            insets: { top: 24, left: 0, right: 0, bottom: 48 },
          },
        },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(
            NavigationContainer,
            null,
            React.createElement(TodayScreen, {
              notebooks: [],
              onDictateNotebook: () => {},
              onEditNotebook: () => {},
            }),
          ),
        ),
      ),
    );
  });
  return tree;
}

async function renderToday(): Promise<Node[]> {
  const tree = await mountToday();
  const json = tree.toJSON();
  const nodes = (Array.isArray(json) ? json : [json]) as Node[];
  await act(async () => {
    tree.unmount();
  });
  return nodes;
}

/** The positions of `wanted` within `all`, which must rise for the order to hold. */
function positions(all: string[], wanted: string[]): number[] {
  return wanted.map((text) => all.indexOf(text));
}

describe('TodayScreen', () => {
  beforeEach(() => {
    seq = 0;
    seedElements([]);
    useEventStore.setState({
      dailyTotals: {},
      habitDoneToday: {},
      skipRowToday: {},
      habitWeekDoneBefore: {},
      habitStreaks: {},
      counterStreaks: {},
      activeTimerSessions: {},
      widgetTimerSessions: {},
      dayStateReady: true,
      counterTotalsReady: true,
    });
    useTodoStore.setState({ todos: [], doneToday: [], loaded: true, loading: false, error: null });
  });

  it('lays the day out in the widget order, under its three headings', async () => {
    const running = element('habit', 'Meditate', { type: 'timer' });
    const open = element('habit', 'Stretch');
    const done = element('habit', 'Read');
    const water = element('counter', 'Water', { unit: 'glass', quickIncrements: [1], dailyTarget: 8 });
    seedElements([done, open, running, water]);
    useEventStore.setState({
      habitDoneToday: { [done.id]: true },
      dailyTotals: { [done.id]: 1 },
      activeTimerSessions: { [running.id]: createActiveTimerSession() },
    });
    useTodoStore.setState({
      todos: [
        todo('Undated errand'),
        todo('Due today', { dueDate: TODAY }),
        todo('Long overdue', { dueDate: '2020-01-01' }),
      ],
      doneToday: [todo('Already ticked', { completedAt: new Date().toISOString() })],
    });

    const shown = texts(await renderToday());
    const order = [
      'Now',
      'Meditate',
      'Stretch',
      'Water',
      'Todos',
      'Long overdue',
      'Due today',
      'Undated errand',
      'Done',
      'Read',
      'Already ticked',
    ];

    const at = positions(shown, order);
    expect(at).not.toContain(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    // Three habits, a targeted counter, three open todos and one ticked: 2 of 8.
    const tally = positions(shown, ['2', ' / 8']);
    expect(tally).not.toContain(-1);
    expect(tally[1]).toBe(tally[0] + 1);
  });

  it('writes what is done on the page: a mark that takes it back, and no streak', async () => {
    const done = element('habit', 'Read');
    const skipped = element('habit', 'Run');
    seedElements([done, skipped, element('habit', 'Stretch')]);
    useEventStore.setState({
      habitDoneToday: { [done.id]: true },
      dailyTotals: { [done.id]: 1 },
      skipRowToday: { [skipped.id]: true },
      habitStreaks: { [done.id]: 12 },
    });
    useTodoStore.setState({
      doneToday: [todo('Already ticked', { completedAt: new Date().toISOString() })],
    });

    const nodes = await renderToday();
    const marks = labels(nodes);

    expect(marks).toContain('Read, Completed. Tap to undo');
    expect(marks).toContain('Run, Undo skip');
    expect(marks).toContain('Mark Already ticked not done');
    // Under the heading there are names and nothing else — no streak caption.
    // Each row's tile and mark draw an icon-font glyph, which is not a word.
    const glyph = /^[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]$/u;
    const shown = texts(nodes).filter((text) => !glyph.test(text));
    expect(shown.slice(shown.indexOf('Done') + 1)).toEqual(['Read', 'Run', 'Already ticked']);
  });

  it('draws the day as one segment per item due, and says it in a sentence', async () => {
    const read = element('habit', 'Read');
    seedElements([read, element('habit', 'Stretch'), element('habit', 'Run')]);
    useEventStore.setState({
      habitDoneToday: { [read.id]: true },
      dailyTotals: { [read.id]: 1 },
      habitStreaks: { [read.id]: 12 },
    });

    const tree = await mountToday();
    const line = tree.root.find(
      (node) => typeof node.type === 'string' && node.props.accessibilityLabel === '1 of 3 done',
    );

    expect(line.props.accessibilityRole).toBe('button');
    expect(line.props.accessibilityHint).toBe('Opens Review');
    // One piece per habit due.
    const pieces = line.findAll((node) => {
      if (typeof node.type !== 'string' || node.type !== 'View') return false;
      const style = StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};
      return style.flex === 1 && style.height != null;
    });
    expect(pieces.length).toBe(3);
    // The best run is each row's to tell, not the header's.
    const header = texts(tree.toJSON() as Node[]);
    expect(header.slice(0, header.indexOf('Read'))).not.toContain('12 days in a row');
    await act(async () => {
      tree.unmount();
    });
  });

  it('draws no progress line when nothing is due', async () => {
    const marks = labels(await renderToday());

    expect(marks.filter((label) => / of \d+ done$/.test(label))).toEqual([]);
  });

  it('pins a habit the widget is timing under Now, and says where it runs', async () => {
    const meditate = element('habit', 'Meditate', { trackingMode: 'timer' });
    seedElements([element('habit', 'Stretch'), meditate]);
    useEventStore.setState({
      widgetTimerSessions: {
        [meditate.id]: { ...createActiveTimerSession(), pausedAt: null, pauseOffsetMs: 0 },
      },
    });

    const shown = texts(await renderToday());

    const at = positions(shown, ['Now', 'Meditate', 'Running in the widget', 'Stretch']);
    expect(at).not.toContain(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('leaves a habit the widget holds paused where it was', async () => {
    const meditate = element('habit', 'Meditate', { trackingMode: 'timer' });
    seedElements([element('habit', 'Stretch'), meditate]);
    useEventStore.setState({
      widgetTimerSessions: {
        [meditate.id]: { ...createActiveTimerSession(), pausedAt: new Date().toISOString() },
      },
    });

    const shown = texts(await renderToday());

    expect(shown).not.toContain('Now');
    expect(shown).not.toContain('Running in the widget');
  });

  it('draws no heading while only one section has rows', async () => {
    seedElements([element('habit', 'Stretch'), element('counter', 'Water', { unit: 'glass', quickIncrements: [1] })]);

    const shown = texts(await renderToday());

    expect(shown).toContain('Stretch');
    expect(shown).not.toContain('Now');
    expect(shown).not.toContain('Todos');
    expect(shown).not.toContain('Done');
  });

  it('still shows the todos when there is no tracker at all', async () => {
    useTodoStore.setState({ todos: [todo('Renew passport')] });

    const shown = texts(await renderToday());

    expect(shown).toContain('No habits or counters yet. Add one to start your daily list.');
    expect(shown).toContain('Open Trackers');
    expect(shown).toContain('Renew passport');
  });

  it('writes the add-a-todo line under the open todos, so a new one lands just above it', async () => {
    seedElements([element('habit', 'Stretch')]);
    useTodoStore.setState({ todos: [todo('Call the plumber'), todo('Buy stamps')] });

    const all = labels(await renderToday());
    const at = (text: string) => all.findIndex((label) => label.includes(text));
    expect(at('Call the plumber')).toBeGreaterThan(-1);
    expect(at('Buy stamps')).toBeGreaterThan(at('Call the plumber'));
    expect(at('Add a todo')).toBeGreaterThan(at('Buy stamps'));
  });

  it('says a dated todo is due on its row, since no heading does', async () => {
    useTodoStore.setState({ todos: [todo('Due today', { dueDate: TODAY })] });

    const shown = texts(await renderToday());

    expect(shown).toContain('Today');
  });

  it('keeps the header buttons where they are when the data lands', async () => {
    seedElements([element('habit', 'Stretch')]);
    useEventStore.setState({ dayStateReady: false });
    const loading = labels(await renderToday());
    expect(loading).not.toContain('Stretch');

    useEventStore.setState({ dayStateReady: true });
    const loaded = labels(await renderToday());

    const header = (all: string[]) => all.slice(0, all.indexOf('Add a tracker') + 1);
    expect(loading).toContain('Add a tracker');
    expect(header(loaded)).toEqual(header(loading));
  });
});
