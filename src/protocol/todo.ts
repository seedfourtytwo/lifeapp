import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { DAY_NOTE_BODY_MAX_LENGTH } from './dayNote';

/**
 * One-off things to get done. A Life Protocol *list*, not an `ElementKind`:
 * a todo is finished once and gone, so there is nothing to aggregate per day
 * and nothing to keep a streak of. Anything that repeats is a habit; anything
 * that happens at a set time is a calendar event (see `.cursor/todos-plan.md`).
 */

export const TODO_TITLE_MAX_LENGTH = 120;

/** Same ceiling as day notes, so the shared note editor's limit UI just works. */
export const TODO_NOTE_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH),
  note: z.string().max(TODO_NOTE_MAX_LENGTH).nullable().default(null),
  /**
   * Date-only on purpose. A deadline says *which day* something has to be
   * done by; a time of day would make this a calendar event.
   */
  dueDate: z.string().regex(DATE_ONLY).nullable().default(null),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  /** Null while open. Set on tick — this is the whole of "history". */
  completedAt: z.string().datetime().nullable().default(null),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type Todo = z.infer<typeof TodoSchema>;
/** Same shape before defaults are applied — nullable fields may be omitted on write. */
export type TodoInput = z.input<typeof TodoSchema>;

/**
 * Display order of the open list. Sections come from the deadline compared to
 * today, so a todo moves between them as days pass — which is why manual
 * order can only ever be a tiebreaker inside one of them.
 */
export const TODO_SECTIONS = ['overdue', 'today', 'later', 'undated'] as const;

export type TodoSection = (typeof TODO_SECTIONS)[number];

export interface TodoGroup {
  section: TodoSection;
  todos: Todo[];
}

export function isTodoOpen(todo: Pick<Todo, 'completedAt'>): boolean {
  return todo.completedAt == null;
}

/**
 * `today` is an app calendar date (`currentAppCalendarDate`). A deadline is due
 * for the whole of its day, so it only becomes overdue once that day is behind us.
 */
export function todoSection(todo: Pick<Todo, 'dueDate'>, today: string): TodoSection {
  if (todo.dueDate == null) return 'undated';
  if (todo.dueDate < today) return 'overdue';
  if (todo.dueDate === today) return 'today';
  return 'later';
}

/**
 * Section first, then the nearest deadline, then manual order. Deadline beats
 * manual order so a dragged todo cannot hide above something due sooner;
 * within one deadline (and within the undated pile) the drag is what decides.
 */
export function compareTodos(a: Todo, b: Todo, today: string): number {
  const sectionDelta =
    TODO_SECTIONS.indexOf(todoSection(a, today)) - TODO_SECTIONS.indexOf(todoSection(b, today));
  if (sectionDelta !== 0) return sectionDelta;

  if (a.dueDate != null && b.dueDate != null && a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  return a.sortOrder - b.sortOrder;
}

/** Open todos only, sorted, with empty sections left out so the list stays quiet. */
export function groupOpenTodos(todos: readonly Todo[], today: string): TodoGroup[] {
  const open = todos.filter(isTodoOpen).sort((a, b) => compareTodos(a, b, today));

  const groups: TodoGroup[] = [];
  for (const todo of open) {
    const section = todoSection(todo, today);
    const last = groups[groups.length - 1];
    if (last?.section === section) {
      last.todos.push(todo);
      continue;
    }
    groups.push({ section, todos: [todo] });
  }
  return groups;
}

/** What the evening reminder counts: open todos already due or past due. */
export function countTodosNeedingAttention(todos: readonly Todo[], today: string): number {
  return todos.filter((todo) => {
    if (!isTodoOpen(todo)) return false;
    const section = todoSection(todo, today);
    return section === 'overdue' || section === 'today';
  }).length;
}

/**
 * New todos go to the bottom of the open list. Completed todos are ignored so
 * a long history cannot push every new sort order into the thousands.
 */
export function nextTodoSortOrder(todos: readonly Todo[]): number {
  const open = todos.filter(isTodoOpen);
  if (open.length === 0) return 0;
  return Math.max(...open.map((todo) => todo.sortOrder)) + 1;
}

export function validateBundleTodos(todos: Todo[]): void {
  const seen = new Set<string>();
  for (const todo of todos) {
    if (seen.has(todo.id)) {
      throw new Error(`Duplicate todo ${todo.id}`);
    }
    seen.add(todo.id);
  }
}
