import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { useShallow } from 'zustand/react/shallow';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import type { RootStackParamList } from '../navigation/types';
import { groupOpenTodos, type Todo } from '../protocol';
import { useTodoStore } from '../store/todoStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { DOCK_RESERVE } from '../ui/homeInsets';
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

const UNDO_DURATION_MS = 5000;

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
  const insets = useSafeAreaInsets();
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
  const [undoTodo, setUndoTodo] = useState<Todo | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupOpenTodos(todos, today), [todos, today]);

  const headerMeta = useMemo(() => {
    const open = todos.filter((todo) => !todo.completedAt).length;
    // The home namespace owns the day header everywhere, so it is read from
    // there rather than duplicated into todos.
    return open === 0 ? tHome('dayHeader.todosClear') : tHome('dayHeader.todosOpen', { count: open });
  }, [todos, tHome]);

  const handleQuickAdd = useCallback(() => {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    setDraftTitle('');
    void create({ title });
  }, [draftTitle, create]);

  const handleToggle = useCallback(
    (todo: Todo) => {
      setUndoTodo(todo);
      void setCompleted(todo.id, true);
    },
    [setCompleted],
  );

  const handleUndo = useCallback(() => {
    const todo = undoTodo;
    setUndoTodo(null);
    if (todo) void setCompleted(todo.id, false);
  }, [undoTodo, setCompleted]);

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
          <View style={todoStyles.emptyWrap}>
            <QuietText variant="bodyLarge" style={styles.empty}>
              {t('list.empty')}
            </QuietText>
            <QuietText variant="bodySmall" style={styles.empty}>
              {t('list.emptyHint')}
            </QuietText>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.section} style={todoStyles.section}>
            <Text
              variant="labelMedium"
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
        todo={editing}
        onDismiss={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={(todo) => remove(todo.id)}
      />

      {/*
        In a Portal and lifted clear of the Home dock: rendered inside the tab
        it lands underneath the dock, where Undo cannot be tapped at all.
      */}
      <Portal>
        <Snackbar
          visible={undoTodo != null}
          onDismiss={() => setUndoTodo(null)}
          duration={UNDO_DURATION_MS}
          wrapperStyle={{ bottom: DOCK_RESERVE + insets.bottom }}
          action={{ label: t('undo.action'), onPress: handleUndo }}
        >
          {undoTodo ? t('undo.done', { title: undoTodo.title }) : ''}
        </Snackbar>
      </Portal>
    </>
  );
}

const todoStyles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  sectionHeading: {
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyWrap: {
    gap: 4,
  },
});

/**
 * Memoised: its only prop is a stable setState, so a Home tab change has no
 * reason to re-render the list.
 */
export default memo(TodosScreen);
