import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { useShallow } from 'zustand/react/shallow';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import type { RootStackParamList } from '../navigation/types';
import { groupOpenTodos, type Todo } from '../protocol';
import { useTodoStore } from '../store/todoStore';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { currentAppCalendarDate } from '../utils/dayRollover';
import TodoEditorSheet, { type TodoDraft } from './todos/TodoEditorSheet';
import TodoQuickAdd from './todos/TodoQuickAdd';
import TodoRow from './todos/TodoRow';
import DayHeader from './shared/DayHeader';
import { DraggableTrackerList } from './shared/DraggableTrackerList';
import {
  HomeTabScrollView,
  type HomeTabScrollViewHandle,
} from './shared/HomeTabScrollView';
import { homeTabScreenStyles as styles } from './shared/screenStyles';

type PendingUndo = { kind: 'done' | 'deleted'; todo: Todo };

type Props = {
  onTrackerDragActiveChange?: (active: boolean) => void;
};

/**
 * Home Todos tab. One-off items only — anything that repeats is a habit, and
 * anything that happens at a set time is a calendar event.
 *
 * Sections are derived from each deadline against today, so a todo moves
 * between them on its own overnight. Drag therefore only reorders *within* a
 * section; you change which section something is in by changing its deadline.
 */
function TodosScreen({ onTrackerDragActiveChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('todos');
  const { t: tHome } = useTranslation('home');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);

  const { todos, loaded, loading, error, load, reload, create, update, setCompleted, remove, reorder } =
    useTodoStore(
      useShallow((s) => ({
        todos: s.todos,
        loaded: s.loaded,
        loading: s.loading,
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
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  // Snackbar callbacks fire after state has moved on (Paper calls onDismiss
  // right after the action), so the pending record is read from a ref.
  const undoRef = useRef<PendingUndo | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // A deleted todo leaves the list at once; the row is only removed from the
  // database once its Undo has run out.
  const pendingDeleteId = undo?.kind === 'deleted' ? undo.todo.id : null;
  const shown = useMemo(
    () => (pendingDeleteId ? todos.filter((todo) => todo.id !== pendingDeleteId) : todos),
    [todos, pendingDeleteId],
  );
  const groups = useMemo(() => groupOpenTodos(shown, today), [shown, today]);

  const headerMeta = useMemo(() => {
    const open = shown.filter((todo) => !todo.completedAt).length;
    // The home namespace owns the day header everywhere, so it is read from
    // there rather than duplicated into todos.
    return open === 0 ? tHome('dayHeader.todosClear') : tHome('dayHeader.todosOpen', { count: open });
  }, [shown, tHome]);

  const handleQuickAdd = useCallback(() => {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    setDraftTitle('');
    void create({ title });
  }, [draftTitle, create]);

  /** Ends the current Undo window: a pending delete is written now. */
  const settleUndo = useCallback(() => {
    const pending = undoRef.current;
    undoRef.current = null;
    setUndo(null);
    if (pending?.kind === 'deleted') void remove(pending.todo.id);
  }, [remove]);

  const offerUndo = useCallback(
    (next: PendingUndo) => {
      settleUndo();
      undoRef.current = next;
      setUndo(next);
    },
    [settleUndo],
  );

  // Leaving Home mid-window still deletes what was deleted.
  useEffect(() => settleUndo, [settleUndo]);

  const handleToggle = useCallback(
    (todo: Todo) => {
      offerUndo({ kind: 'done', todo });
      void setCompleted(todo.id, true);
    },
    [offerUndo, setCompleted],
  );

  const handleDelete = useCallback(
    (todo: Todo) => offerUndo({ kind: 'deleted', todo }),
    [offerUndo],
  );

  const handleUndo = useCallback(() => {
    const pending = undoRef.current;
    undoRef.current = null;
    setUndo(null);
    if (pending?.kind === 'done') void setCompleted(pending.todo.id, false);
  }, [setCompleted]);

  const handleOpen = useCallback((todo: Todo) => {
    setEditing(todo);
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(
    async (draft: TodoDraft) => {
      if (editing) {
        await update(editing.id, draft);
        return;
      }
      await create(draft);
    },
    [editing, update, create],
  );

  const openHistory = useCallback(() => navigation.navigate('TodoHistory'), [navigation]);

  if (!loaded && loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <HomeTabScrollView
        ref={scrollRef}
        scrollLocked={scrollLocked}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {t('list.loadFailed')}
            </Text>
            <Button mode="outlined" onPress={() => void reload()}>
              {t('list.retry')}
            </Button>
          </View>
        ) : null}

        <DayHeader
          now={now}
          meta={headerMeta}
          actions={
            <IconButton
              icon="history"
              size={22}
              onPress={openHistory}
              accessibilityLabel={t('list.historyA11y')}
            />
          }
        />

        <TodoQuickAdd
          value={draftTitle}
          onChangeText={setDraftTitle}
          onSubmit={handleQuickAdd}
          // The editor sits on top of this field with a mic of its own; only
          // one take can be open at a time, so this one stands down.
          dictationActive={!editorOpen}
        />

        {groups.length === 0 ? (
          <EmptyState message={t('list.empty')} />
        ) : null}

        {groups.map((group) => (
          <View key={group.section} style={todoStyles.section}>
            <Text
              accessibilityRole="header"
              style={[todoStyles.sectionHeading, { color: theme.colors.onSurfaceVariant }]}
            >
              {t(`sections.${group.section}`)}
            </Text>

            <DraggableTrackerList
              itemIds={group.todos.map((todo) => todo.id)}
              scrollRef={scrollRef}
              onDragActiveChange={(active) => {
                setScrollLocked(active);
                onTrackerDragActiveChange?.(active);
              }}
              // Only this section's ids move, so the write can reuse their own
              // sort_order slots and leave every other section untouched.
              onReorder={(nextIds) => reorder(nextIds)}
              renderItem={(id, drag) => {
                const todo = group.todos.find((candidate) => candidate.id === id);
                if (!todo) return null;
                return (
                  <TodoRow
                    todo={todo}
                    today={today}
                    onToggle={handleToggle}
                    onOpen={handleOpen}
                    onLongPressReorder={drag.canDrag ? drag.onLongPress : undefined}
                    onReorderTouchMove={drag.canDrag ? drag.onTouchMove : undefined}
                    onReorderTouchEnd={drag.canDrag ? drag.onTouchEnd : undefined}
                    onReorderTouchCancel={drag.canDrag ? drag.onTouchCancel : undefined}
                    delayLongPressReorder={drag.delayLongPress}
                    reorderHint={drag.canDrag ? t('list.reorderHint') : undefined}
                  />
                );
              }}
            />
          </View>
        ))}
      </HomeTabScrollView>

      <TodoEditorSheet
        visible={editorOpen}
        today={today}
        todo={editing}
        onDismiss={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <UndoSnackbar
        message={undo ? t(`undo.${undo.kind}`, { title: undo.todo.title }) : null}
        onUndo={handleUndo}
        onDismiss={settleUndo}
      />
    </>
  );
}

const todoStyles = StyleSheet.create({
  section: {
    marginBottom: layout.sectionGap - layout.rowGap,
  },
  sectionHeading: {
    ...typeScale.caption,
    fontSize: 14,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
});

/**
 * Memoised: its only prop is a stable setState, so a Home tab change has no
 * reason to re-render the list.
 */
export default memo(TodosScreen);
