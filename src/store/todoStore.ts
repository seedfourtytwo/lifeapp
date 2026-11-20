import { create } from 'zustand';
import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as todoRepo from '../db/repositories/todoRepository';
import type { NewTodo, TodoPatch } from '../db/repositories/todoRepository';
import type { Todo } from '../protocol';
import { currentAppCalendarDate } from '../utils/dayRollover';

let loadGeneration = 0;

interface TodoState {
  /**
   * Open todos only. Completed ones are read straight from SQLite by the
   * history screen — keeping years of finished todos in memory would buy
   * nothing, since nothing on the open list depends on them.
   */
  todos: Todo[];
  /**
   * Todos ticked on the current app day, oldest tick first — the order the
   * widget lists them in. Today keeps them under Done so a slip can be reopened;
   * the day's handful is all that is held, never the history.
   */
  doneToday: Todo[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  /** Resolves to undefined when a clear/import discarded the write. */
  create: (input: NewTodo) => Promise<Todo | undefined>;
  update: (id: string, patch: TodoPatch) => Promise<void>;
  /** Tick or un-tick. Un-ticking is what the Undo snackbar calls. */
  setCompleted: (id: string, completed: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: readonly string[]) => Promise<void>;
}

async function fetchLists(): Promise<Pick<TodoState, 'todos' | 'doneToday'>> {
  const db = await getDatabase();
  // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
  const todos = await todoRepo.getOpenTodos(db);
  const newestFirst = await todoRepo.getCompletedTodos(db, { date: currentAppCalendarDate() });
  return { todos, doneToday: newestFirst.reverse() };
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  doneToday: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    const state = get();
    if (state.loaded || state.loading) return;
    await get().reload();
  },

  reload: async () => {
    const generation = ++loadGeneration;
    set({ loading: true });
    try {
      const lists = await fetchLists();
      if (generation !== loadGeneration) return;
      set({ ...lists, loaded: true, loading: false, error: null });
    } catch (error) {
      if (generation !== loadGeneration) return;
      console.warn('Failed to load todos', error);
      set({ loading: false, error: 'load' });
    }
  },

  create: async (input) => {
    const created = await withGuardedWrite('todos', async ({ superseded }) => {
      const db = await getDatabase();
      if (superseded()) return undefined;
      return todoRepo.createTodo(db, input);
    });
    await get().reload();
    return created;
  },

  update: async (id, patch) => {
    await withGuardedWrite('todos', async ({ superseded }) => {
      const db = await getDatabase();
      if (superseded()) return;
      await todoRepo.updateTodo(db, id, patch);
    });
    await get().reload();
  },

  setCompleted: async (id, completed) => {
    await withGuardedWrite('todos', async ({ superseded }) => {
      const db = await getDatabase();
      if (superseded()) return;
      await todoRepo.setTodoCompleted(db, id, completed ? new Date().toISOString() : null);
    });
    await get().reload();
  },

  remove: async (id) => {
    await withGuardedWrite('todos', async ({ superseded }) => {
      const db = await getDatabase();
      if (superseded()) return;
      await todoRepo.deleteTodo(db, id);
    });
    await get().reload();
  },

  reorder: async (orderedIds) => {
    // Optimistic: the drag already moved the rows on screen, and re-sorting
    // from the store after the write would make them jump back and forth.
    const previous = get().todos;
    const byId = new Map(previous.map((todo) => [todo.id, todo]));
    const slots = orderedIds
      .map((id) => byId.get(id)?.sortOrder)
      .filter((order): order is number => order != null)
      .sort((a, b) => a - b);
    set({
      todos: previous.map((todo) => {
        const index = orderedIds.indexOf(todo.id);
        return index === -1 || slots[index] == null
          ? todo
          : { ...todo, sortOrder: slots[index] };
      }),
    });

    try {
      await withGuardedWrite('todos', async ({ superseded }) => {
        const db = await getDatabase();
        if (superseded()) return;
        await todoRepo.reorderTodos(db, orderedIds);
      });
    } catch (error) {
      console.warn('Failed to reorder todos', error);
    }
    await get().reload();
  },
}));
