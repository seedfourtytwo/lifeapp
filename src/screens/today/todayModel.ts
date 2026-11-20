import { groupOpenTodos, type Todo, type TodoSection } from '../../protocol';

/**
 * What Today shows, in what order, and how the header counts it.
 *
 * This mirrors `TodayRules.buildToday` in the widget module
 * (`modules/life-widget/.../TodayRules.kt`) — keep the two in step. The widget
 * and this page are the same day seen from two places, so a row may never sit
 * under a different heading, or count differently, depending on where you look.
 */

/**
 * `TodayRules.MAX_TODOS`: the widget lists — and so counts — at most this many
 * open todos. The page lists them all, but its header counts the same ones the
 * widget does, so "x of y done" reads the same in both places.
 */
export const WIDGET_MAX_TODOS = 5;

/** The headings the page can carry. Open habits and counters run under none. */
export type TodayLabel = 'now' | 'todos' | 'done';

/** One active habit, as today finds it. Supply them in the user's order. */
export interface TodayHabitFacts {
  id: string;
  /** Scheduled today and inside its visibility window — skipped or not. */
  offered: boolean;
  done: boolean;
  /** Today holds a skip and the habit is not done. */
  skipped: boolean;
  /** A timer is open on it. */
  running: boolean;
}

/** One active counter. Supply them in the user's order. */
export interface TodayCounterFacts {
  id: string;
  hasTarget: boolean;
  /** Has a target and reached it. */
  complete: boolean;
  /** Has a target, holds a skip today, and has not reached it. */
  skipped: boolean;
}

export interface TodayInput {
  habits: readonly TodayHabitFacts[];
  counters: readonly TodayCounterFacts[];
  openTodos: readonly Todo[];
  /** Ticked today, oldest tick first. */
  doneTodos: readonly Pick<Todo, 'id'>[];
  /** The app calendar date the todo deadlines are read against. */
  today: string;
}

export interface TodayTodoGroup {
  section: TodoSection;
  ids: string[];
}

export interface TodayModel {
  /** Habits with a timer open. */
  now: string[];
  /** Due habits still to do. Draggable among themselves. */
  openHabits: string[];
  /** Every active counter; one at its target stays where the user put it. */
  counters: string[];
  /**
   * Open todos: overdue, today, later, undated. One entry per due-group that
   * has rows, because a drag only reorders inside its own group.
   */
  todoGroups: TodayTodoGroup[];
  /** Done and skipped habits. */
  doneHabits: string[];
  /** Todos ticked today; they follow the habits under Done. */
  doneTodos: string[];
  /** Which headings to draw: only when more than one section has rows. */
  labels: Record<TodayLabel, boolean>;
  /** Header figures: `done` of `due`, counted exactly as the widget counts them. */
  done: number;
  due: number;
}

export function buildTodayModel({
  habits,
  counters,
  openTodos,
  doneTodos,
  today,
}: TodayInput): TodayModel {
  const now: string[] = [];
  const openHabits: string[] = [];
  const doneHabits: string[] = [];
  let due = 0;
  let done = 0;

  for (const habit of habits) {
    // A running timer always keeps its row: without it there is nothing to stop it with.
    if (!habit.offered && !habit.running) continue;

    // A skipped habit is not due today, so it leaves the count.
    if (habit.offered && !habit.skipped) {
      due += 1;
      if (habit.done) done += 1;
    }

    if (habit.running) now.push(habit.id);
    else if (habit.done || habit.skipped) doneHabits.push(habit.id);
    else openHabits.push(habit.id);
  }

  for (const counter of counters) {
    // No target, nothing to finish; skipped, not due. Either way the row stays usable.
    if (!counter.hasTarget || counter.skipped) continue;
    due += 1;
    if (counter.complete) done += 1;
  }

  const todoGroups = groupOpenTodos(openTodos, today).map((group) => ({
    section: group.section,
    ids: group.todos.map((todo) => todo.id),
  }));
  const openTodoCount = todoGroups.reduce((count, group) => count + group.ids.length, 0);
  // The open todos the widget shows (the first few, in this same order), plus
  // every one ticked today.
  due += Math.min(openTodoCount, WIDGET_MAX_TODOS) + doneTodos.length;
  done += doneTodos.length;

  const counterIds = counters.map((counter) => counter.id);
  const doneTodoIds = doneTodos.map((todo) => todo.id);

  const hasNow = now.length > 0;
  const hasDay = openHabits.length + counterIds.length > 0;
  const hasTodos = openTodoCount > 0;
  const hasDone = doneHabits.length + doneTodoIds.length > 0;
  const labelled = [hasNow, hasDay, hasTodos, hasDone].filter(Boolean).length > 1;

  return {
    now,
    openHabits,
    counters: counterIds,
    todoGroups,
    doneHabits,
    doneTodos: doneTodoIds,
    labels: { now: labelled && hasNow, todos: labelled && hasTodos, done: labelled && hasDone },
    done,
    due,
  };
}
