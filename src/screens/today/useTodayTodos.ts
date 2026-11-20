import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Todo } from '../../protocol';
import { useTodoStore } from '../../store/todoStore';
import { playHabitCompleteHaptic } from '../../utils/habitHaptics';
import type { TodoDraft } from '../todos/TodoEditorSheet';
import type { UndoBar } from './useUndoBar';

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

export type TodayTodos = {
  /** Open todos, less any whose delete is waiting out its Undo. */
  open: Todo[];
  /** Ticked today, oldest tick first. */
  doneToday: Todo[];
  /** The first load has not landed yet. */
  waiting: boolean;
  loadFailed: boolean;
  reload: () => Promise<void>;
  /** The quick-add field. */
  draftTitle: string;
  setDraftTitle: (next: string) => void;
  submitDraft: () => void;
  /** The editor sheet. */
  editing: Todo | null;
  editorOpen: boolean;
  closeEditor: () => void;
  saveEditor: (draft: TodoDraft) => Promise<void>;
  /** Stable handlers for the memoised rows. */
  onOpen: (todo: Todo) => void;
  onFinish: (todo: Todo) => void;
  onReopen: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  /** Persist a drag inside one due-group. */
  reorder: (orderedIds: readonly string[]) => Promise<void>;
};

/**
 * The todos half of Today: the open list, what was ticked today, the quick-add
 * draft and the editor.
 *
 * @param today The app calendar date; when it rolls over, yesterday's ticked
 *   todos leave Done.
 */
export function useTodayTodos(today: string, undoBar: UndoBar): TodayTodos {
  const { t } = useTranslation('todos');
  const { todos, doneToday, loaded, error, load, reload, create, update, setCompleted, remove, reorder } =
    useTodoStore(
      useShallow((s) => ({
        todos: s.todos,
        doneToday: s.doneToday,
        loaded: s.loaded,
        error: s.error,
        load: s.load,
        reload: s.reload,
        create: s.create,
        update: s.update,
        setCompleted: s.setCompleted,
        remove: s.remove,
        reorder: s.reorder,
      })),
    );

  const [draftTitle, setDraftTitle] = useState('');
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  /**
   * Deleted todos still inside their Undo window (or mid-write). The row
   * leaves the list at once; SQLite only loses it when the window closes.
   */
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(NOTHING_HIDDEN);

  // "Ticked today" is a question about a date: ask again when the date moves.
  const loadedForDay = useRef<string | null>(null);
  useEffect(() => {
    const first = loadedForDay.current == null;
    loadedForDay.current = today;
    void (first ? load() : reload());
  }, [today, load, reload]);

  // The widget ticks todos while the app sits in the background, and nothing
  // else re-reads them on the way back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const open = useMemo(
    () => (hiddenIds.size > 0 ? todos.filter((todo) => !hiddenIds.has(todo.id)) : todos),
    [todos, hiddenIds],
  );

  // Stable callbacks for the memoised rows; the latest values ride on a ref.
  const latest = useRef({ undoBar, t });
  latest.current = { undoBar, t };

  const submitDraft = useCallback(() => {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    setDraftTitle('');
    void create({ title });
  }, [draftTitle, create]);

  const onFinish = useCallback(
    (todo: Todo) => {
      const { undoBar: bar, t: tTodos } = latest.current;
      void playHabitCompleteHaptic();
      bar.offer({
        message: tTodos('undo.done', { title: todo.title }),
        undo: () => setCompleted(todo.id, false),
      });
      void setCompleted(todo.id, true);
    },
    [setCompleted],
  );

  const onReopen = useCallback(
    (todo: Todo) => {
      void setCompleted(todo.id, false);
    },
    [setCompleted],
  );

  const onDelete = useCallback(
    (todo: Todo) => {
      const { undoBar: bar, t: tTodos } = latest.current;
      const show = () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(todo.id);
          return next.size > 0 ? next : NOTHING_HIDDEN;
        });
      setHiddenIds((prev) => new Set(prev).add(todo.id));
      bar.offer({
        message: tTodos('undo.deleted', { title: todo.title }),
        undo: show,
        // The delete is written only now. It stays hidden until the write has
        // landed, or the row would flash back for the length of a query.
        settle: () => {
          // A failed delete brings the row back, which is the truth: it is still there.
          void remove(todo.id).then(show, show);
        },
      });
    },
    [remove],
  );

  const onOpen = useCallback((todo: Todo) => {
    setEditing(todo);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
  }, []);

  const saveEditor = useCallback(
    async (draft: TodoDraft) => {
      if (editing) {
        await update(editing.id, draft);
        return;
      }
      await create(draft);
    },
    [editing, update, create],
  );

  return {
    open,
    doneToday,
    waiting: !loaded && error == null,
    loadFailed: error != null,
    reload,
    draftTitle,
    setDraftTitle,
    submitDraft,
    editing,
    editorOpen,
    closeEditor,
    saveEditor,
    onOpen,
    onFinish,
    onReopen,
    onDelete,
    reorder,
  };
}
