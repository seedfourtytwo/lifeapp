import { PROTOCOL_VERSION, TodoSchema, type Todo } from '../src/protocol';
import {
  buildTodayModel,
  type TodayCounterFacts,
  type TodayHabitFacts,
  type TodayInput,
} from '../src/screens/today/todayModel';

/**
 * The cases mirror `TodayRulesTest` on the widget side: the app's Today page
 * and the widget must put the same rows in the same order and count the same
 * "x of y done".
 */

const TODAY = '2026-11-18';

function habit(id: string, facts: Partial<TodayHabitFacts> = {}): TodayHabitFacts {
  return { id, offered: true, done: false, skipped: false, running: false, ...facts };
}

function counter(id: string, facts: Partial<TodayCounterFacts> = {}): TodayCounterFacts {
  return { id, hasTarget: false, complete: false, skipped: false, ...facts };
}

let todoCount = 0;
function todo(title: string, overrides: Partial<Todo> = {}): Todo {
  todoCount += 1;
  return TodoSchema.parse({
    id: `00000000-0000-4000-8000-${String(todoCount).padStart(12, '0')}`,
    title,
    sortOrder: todoCount,
    createdAt: '2026-11-01T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

function build(input: Partial<TodayInput> = {}) {
  return buildTodayModel({
    habits: [],
    counters: [],
    openTodos: [],
    doneTodos: [],
    today: TODAY,
    ...input,
  });
}

describe('buildTodayModel', () => {
  it('is empty on an empty day', () => {
    expect(build()).toEqual({
      now: [],
      openHabits: [],
      counters: [],
      todoGroups: [],
      doneHabits: [],
      doneTodos: [],
      labels: { now: false, todos: false, done: false },
      done: 0,
      due: 0,
    });
  });

  it('lists only habits under no heading, in the order given', () => {
    const model = build({ habits: [habit('b'), habit('a'), habit('c')] });

    expect(model.openHabits).toEqual(['b', 'a', 'c']);
    expect(model.labels).toEqual({ now: false, todos: false, done: false });
    expect([model.done, model.due]).toEqual([0, 3]);
  });

  it('leaves out a habit that is not offered today', () => {
    const model = build({ habits: [habit('a'), habit('off', { offered: false })] });

    expect(model.openHabits).toEqual(['a']);
    expect(model.due).toBe(1);
  });

  it('pins a running timer to Now and still counts it as due', () => {
    const model = build({ habits: [habit('a'), habit('timer', { running: true }), habit('c')] });

    expect(model.now).toEqual(['timer']);
    expect(model.openHabits).toEqual(['a', 'c']);
    expect(model.labels.now).toBe(true);
    expect([model.done, model.due]).toEqual([0, 3]);
  });

  it('keeps a done habit under Now while its timer still runs', () => {
    const model = build({ habits: [habit('timer', { running: true, done: true }), habit('b')] });

    expect(model.now).toEqual(['timer']);
    expect(model.doneHabits).toEqual([]);
    expect([model.done, model.due]).toEqual([1, 2]);
  });

  it('keeps the row of a running timer that is not offered today, uncounted', () => {
    const model = build({ habits: [habit('timer', { offered: false, running: true })] });

    expect(model.now).toEqual(['timer']);
    expect([model.done, model.due]).toEqual([0, 0]);
  });

  it('sinks a done habit to Done and counts it', () => {
    const model = build({ habits: [habit('a', { done: true }), habit('b')] });

    expect(model.openHabits).toEqual(['b']);
    expect(model.doneHabits).toEqual(['a']);
    expect(model.labels).toEqual({ now: false, todos: false, done: true });
    expect([model.done, model.due]).toEqual([1, 2]);
  });

  it('sinks a skipped habit to Done and takes it out of the due count', () => {
    const model = build({ habits: [habit('a', { skipped: true }), habit('b')] });

    expect(model.openHabits).toEqual(['b']);
    expect(model.doneHabits).toEqual(['a']);
    expect([model.done, model.due]).toEqual([0, 1]);
  });

  it('counts a counter only when it has a target', () => {
    const model = build({
      counters: [
        counter('free'),
        counter('open', { hasTarget: true }),
        counter('hit', { hasTarget: true, complete: true }),
      ],
    });

    expect([model.done, model.due]).toEqual([1, 2]);
  });

  it('leaves a counter at its target where the user put it', () => {
    const model = build({
      habits: [habit('h')],
      counters: [counter('hit', { hasTarget: true, complete: true }), counter('open')],
    });

    expect(model.counters).toEqual(['hit', 'open']);
    expect(model.doneHabits).toEqual([]);
    // Open habits and counters are one run: no heading between or above them.
    expect(model.labels).toEqual({ now: false, todos: false, done: false });
  });

  it('keeps a skipped counter listed but out of the count', () => {
    const model = build({ counters: [counter('skip', { hasTarget: true, skipped: true })] });

    expect(model.counters).toEqual(['skip']);
    expect([model.done, model.due]).toEqual([0, 0]);
  });

  it('orders open todos overdue, today, later, undated — grouped for dragging', () => {
    const undated = todo('undated');
    const later = todo('later', { dueDate: '2026-11-25' });
    const dueToday = todo('today', { dueDate: TODAY });
    const overdue = todo('overdue', { dueDate: '2026-11-10' });
    const undatedTwo = todo('undated two');

    const model = build({ openTodos: [undated, later, dueToday, overdue, undatedTwo] });

    expect(model.todoGroups).toEqual([
      { section: 'overdue', ids: [overdue.id] },
      { section: 'today', ids: [dueToday.id] },
      { section: 'later', ids: [later.id] },
      { section: 'undated', ids: [undated.id, undatedTwo.id] },
    ]);
    expect([model.done, model.due]).toEqual([0, 5]);
  });

  it('counts todos done today as both due and done, after the done habits', () => {
    const open = todo('open');
    const ticked = todo('ticked', { completedAt: '2026-11-18T08:00:00.000Z' });

    const model = build({
      habits: [habit('a', { done: true })],
      openTodos: [open],
      doneTodos: [ticked],
    });

    expect(model.doneHabits).toEqual(['a']);
    expect(model.doneTodos).toEqual([ticked.id]);
    expect([model.done, model.due]).toEqual([2, 3]);
  });

  it('counts at most the five open todos the widget lists, and lists them all', () => {
    const openTodos = Array.from({ length: 8 }, (_, index) => todo(`todo ${index}`));
    const ticked = [todo('a'), todo('b')];

    const model = build({ openTodos, doneTodos: ticked });

    expect(model.todoGroups[0]!.ids).toHaveLength(8);
    // TodayRules: `due += todoRows.size + doneTodos.size`, todoRows capped at MAX_TODOS.
    expect([model.done, model.due]).toEqual([2, 7]);
  });

  it('counts every open todo while they fit the widget', () => {
    const openTodos = Array.from({ length: 5 }, (_, index) => todo(`todo ${index}`));

    expect(build({ openTodos }).due).toBe(5);
  });

  it('shows no heading while a single section has rows', () => {
    expect(build({ openTodos: [todo('only')] }).labels).toEqual({
      now: false,
      todos: false,
      done: false,
    });
    expect(build({ habits: [habit('a', { done: true })] }).labels).toEqual({
      now: false,
      todos: false,
      done: false,
    });
  });

  it('heads every named section once more than one has rows', () => {
    const model = build({
      habits: [habit('run', { running: true }), habit('open'), habit('done', { done: true })],
      counters: [counter('c')],
      openTodos: [todo('t')],
    });

    expect(model.labels).toEqual({ now: true, todos: true, done: true });
  });

  it('heads Todos, and nothing else, beside the unnamed run', () => {
    const model = build({ habits: [habit('a')], openTodos: [todo('t')] });

    expect(model.labels).toEqual({ now: false, todos: true, done: false });
  });

  it('keeps the given order inside every section', () => {
    const model = build({
      habits: [
        habit('d1', { done: true }),
        habit('o1'),
        habit('s1', { skipped: true }),
        habit('o2'),
        habit('d2', { done: true }),
        habit('r1', { running: true }),
        habit('r2', { running: true }),
      ],
      counters: [counter('c2'), counter('c1')],
    });

    expect(model.now).toEqual(['r1', 'r2']);
    expect(model.openHabits).toEqual(['o1', 'o2']);
    expect(model.counters).toEqual(['c2', 'c1']);
    expect(model.doneHabits).toEqual(['d1', 's1', 'd2']);
  });
});
