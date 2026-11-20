import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { notify } from '../components/sheet/confirm';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { refreshAllDailyData } from '../hooks/refreshAllDailyData';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost } from '../notes';
import { TODO_SECTIONS, type ElementDefinition } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { space } from '../theme/spacing';
import { currentAppCalendarDate } from '../utils/dayRollover';
import DayHeader from './shared/DayHeader';
import DayProgress from './shared/DayProgress';
import { DraggableTrackerList } from './shared/DraggableTrackerList';
import EmptyTabState from './shared/EmptyTabState';
import HomeTabLoadingPane from './shared/HomeTabLoadingPane';
import { HomeTabScrollView, type HomeTabScrollViewHandle } from './shared/HomeTabScrollView';
import type { HomeTrackerTabProps } from './shared/homeTabProps';
import NotebookButtons from './shared/NotebookButtons';
import { homeTabScreenStyles } from './shared/screenStyles';
import { useHomeTrackerNotes } from './shared/useHomeTrackerNotes';
import { Appear, SECTION_TOP_GAP, SectionLabel, TodaySettledContext } from './today/TodaySection';
import { buildTodayModel } from './today/todayModel';
import { useTodayCounters } from './today/useTodayCounters';
import { useTodayHabits } from './today/useTodayHabits';
import { useTodayRows } from './today/useTodayRows';
import { useTodayTodos } from './today/useTodayTodos';
import { useUndoBar } from './today/useUndoBar';
import TodoEditorSheet from './todos/TodoEditorSheet';
import TodoQuickAdd from './todos/TodoQuickAdd';

type Props = HomeTrackerTabProps;

/**
 * Today: the whole day as one list, in the widget's order — what is running
 * now, the habits still to do, the counters, the todos, then what is done.
 *
 * The order and the header's done-of-due come from `buildTodayModel`, which
 * mirrors the widget's `TodayRules.buildToday`. This file only lays the model
 * out; the hooks beside it own the stores, the callbacks and the rows.
 */
export default function TodayScreen({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
  journalOpen = false,
  notesActive = true,
  onBeforeOpenTrackerNote,
  onTrackerNotesOpenChange,
  onTrackerDragActiveChange,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const { t: tTodos } = useTranslation('todos');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const elementError = useElementStore((s) => s.error);
  const reorderHabitToOrder = useElementStore((s) => s.reorderHabitToOrder);
  const reorderCounterToOrder = useElementStore((s) => s.reorderCounterToOrder);

  // One clock for the page: every "today" below is this one.
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);
  const undoBar = useUndoBar();
  const habits = useTodayHabits(now);
  const counters = useTodayCounters(undoBar);
  const todos = useTodayTodos(today, undoBar);

  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);
  const quickAddRef = useRef<View>(null);
  const [quickAddFocused, setQuickAddFocused] = useState(false);

  const { settle: settleUndo, offer: offerUndo } = undoBar;
  useEffect(() => {
    if (notesActive) return;
    setScrollLocked(false);
    // Undo belongs to the page it was offered on; leaving the page settles it.
    settleUndo();
  }, [notesActive, settleUndo]);

  const model = useMemo(
    () =>
      buildTodayModel({
        habits: habits.facts,
        counters: counters.facts,
        openTodos: todos.open,
        doneTodos: todos.doneToday,
        today,
      }),
    [habits.facts, counters.facts, todos.open, todos.doneToday, today],
  );

  // The note icons cover every active tracker, not only the ones due today.
  const trackerIds = useMemo(
    () => [...habits.activeIds, ...counters.activeIds],
    [habits.activeIds, counters.activeIds],
  );
  const { notesToday, reloadNotesToday, noteEditor } = useHomeTrackerNotes({
    elementIds: trackerIds,
    now,
    journalOpen,
    notesActive,
    onTrackerNotesOpenChange,
  });

  // Stable callbacks for the memoised cards; the latest values ride on a ref.
  const latest = useRef({
    noteEditor,
    now,
    onBeforeOpenTrackerNote,
    onTrackerDragActiveChange,
  });
  latest.current = {
    noteEditor,
    now,
    onBeforeOpenTrackerNote,
    onTrackerDragActiveChange,
  };

  const openNote = useCallback((element: ElementDefinition, dictate: boolean) => {
    const { noteEditor: editor, now: at, onBeforeOpenTrackerNote: beforeOpen } = latest.current;
    beforeOpen?.();
    void editor.open(
      { kind: 'tracker', elementId: element.id, label: element.name },
      currentAppCalendarDate(at),
      dictate ? { dictate: true } : undefined,
    );
  }, []);

  const handleDragActiveChange = useCallback((active: boolean) => {
    setScrollLocked(active);
    latest.current.onTrackerDragActiveChange?.(active);
  }, []);

  const { renderHabit, renderDoneHabit, renderCounter, renderOpenTodo, renderDoneTodo } =
    useTodayRows({
      habits,
      counters,
      todos,
      today,
      notesToday,
      openNote,
      offerUndo,
    });

  /** A failed reorder says so, and rejects so the list puts the row back. */
  const saveOrder = (write: Promise<void>) =>
    write.catch((error: unknown) => {
      notify({
        title: tCommon('alerts.couldNotSave'),
        message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      });
      throw error;
    });

  const reloadAll = async () => {
    await Promise.all([refreshAllDailyData(), todos.reload()]);
    await reloadNotesToday();
  };

  // Built once and shown by both the loading pane and the loaded page, so the
  // buttons beside the date do not move when the data lands.
  const headerActions = (
    <>
      <NotebookButtons
        notebooks={notebooks}
        onDictateNotebook={onDictateNotebook}
        onEditNotebook={onEditNotebook}
      />
      <IconButton
        icon="plus"
        size={24}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={() => navigation.navigate('Trackers', { add: true })}
        accessibilityLabel={t('today.addTrackerA11y')}
        style={styles.addButton}
      />
    </>
  );
  const editorHost = <NoteEditorHost session={noteEditor} />;

  const waiting = habits.waiting || counters.waiting || todos.waiting;
  const loading = waiting && !elementError;

  // What is on the page when it first shows simply is; later arrivals fade in.
  const settled = useRef(false);
  useEffect(() => {
    if (!loading) settled.current = true;
  }, [loading]);

  if (loading) {
    return (
      <>
        <HomeTabLoadingPane actions={headerActions} />
        {editorHost}
      </>
    );
  }

  const hasTrackers = trackerIds.length > 0;
  const trackerRows =
    model.now.length + model.openHabits.length + model.counters.length + model.doneHabits.length;
  let emptyMessage: string | null = null;
  if (!hasTrackers) {
    emptyMessage =
      habits.totalCount + counters.totalCount === 0
        ? t('today.emptyNoTrackers')
        : t('today.emptyNoActiveTrackers');
  } else if (trackerRows === 0) {
    emptyMessage = t('today.emptyNothingDue');
  }

  // Nothing but the day header (or the empty state, which brings its own gap)
  // sits above the todos.
  const todosLead = model.now.length + model.openHabits.length + model.counters.length === 0;

  return (
    <TodaySettledContext.Provider value={settled}>
      <HomeTabScrollView
        ref={scrollRef}
        scrollLocked={scrollLocked}
        contentContainerStyle={homeTabScreenStyles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyboardField={quickAddFocused ? quickAddRef : null}
      >
        {elementError || todos.loadFailed ? (
          <View style={homeTabScreenStyles.errorBox}>
            <Text style={[homeTabScreenStyles.error, { color: theme.colors.error }]}>
              {elementError ?? tTodos('list.loadFailed')}
            </Text>
            <Button mode="outlined" onPress={() => void reloadAll()}>
              {t('today.retry')}
            </Button>
          </View>
        ) : null}

        <DayHeader now={now} actions={headerActions}>
          <DayProgress
            done={model.done}
            due={model.due}
            onPress={() => navigation.navigate('Review')}
          />
        </DayHeader>

        {emptyMessage ? (
          <View style={styles.emptyState}>
            {hasTrackers ? (
              <QuietText variant="bodyLarge" style={homeTabScreenStyles.empty}>
                {emptyMessage}
              </QuietText>
            ) : (
              <EmptyTabState message={emptyMessage} />
            )}
          </View>
        ) : null}

        {model.labels.now ? <SectionLabel first>{t('today.now')}</SectionLabel> : null}
        {model.now.map((id) => (
          <Appear key={id}>{renderHabit(id)}</Appear>
        ))}

        {/* Open habits and counters are the day itself: one run, under no heading. */}
        <DraggableTrackerList
          itemIds={model.openHabits}
          scrollRef={scrollRef}
          onDragActiveChange={handleDragActiveChange}
          onReorder={(nextIds) => saveOrder(reorderHabitToOrder(nextIds))}
          renderItem={renderHabit}
        />
        <DraggableTrackerList
          itemIds={model.counters}
          scrollRef={scrollRef}
          onDragActiveChange={handleDragActiveChange}
          onReorder={(nextIds) => saveOrder(reorderCounterToOrder(nextIds))}
          renderItem={renderCounter}
        />

        {model.labels.todos ? (
          <SectionLabel first={todosLead}>{t('today.todos')}</SectionLabel>
        ) : null}
        <View style={!model.labels.todos && !todosLead ? styles.unlabelledSection : undefined}>
          {/* One list per due-group, back to back: a drag stays inside its group,
              and each row already says when it is due. All four are always
              mounted, so a group's last todo can still fade out of it. */}
          {TODO_SECTIONS.map((section) => (
            <DraggableTrackerList
              key={section}
              itemIds={model.todoGroups.find((group) => group.section === section)?.ids ?? NO_IDS}
              scrollRef={scrollRef}
              onDragActiveChange={handleDragActiveChange}
              // Only this group's ids move, so the write reuses their own
              // sort_order slots and leaves every other group untouched.
              onReorder={todos.reorder}
              renderItem={renderOpenTodo}
            />
          ))}
          {/* Under the rows: a todo filed from it lands just above, in view
              over the keyboard. */}
          <View
            ref={quickAddRef}
            // Measured against the keyboard, so it has to exist as a native view.
            collapsable={false}
          >
            <TodoQuickAdd
              value={todos.draftTitle}
              onChangeText={todos.setDraftTitle}
              onSubmit={todos.submitDraft}
              // The editor sits on top of this field with a mic of its own; only
              // one take can be open at a time, so this one stands down.
              dictationActive={!todos.editorOpen}
              onFocusChange={setQuickAddFocused}
            />
          </View>
        </View>

        {model.labels.done ? <SectionLabel>{t('today.done')}</SectionLabel> : null}
        {model.doneHabits.map((id) => (
          <Appear key={id}>{renderDoneHabit(id)}</Appear>
        ))}
        {model.doneTodos.map((id) => (
          <Appear key={id}>{renderDoneTodo(id)}</Appear>
        ))}
      </HomeTabScrollView>

      {editorHost}
      <TodoEditorSheet
        visible={todos.editorOpen}
        today={today}
        todo={todos.editing}
        onDismiss={todos.closeEditor}
        onSave={todos.saveEditor}
        onDelete={todos.onDelete}
      />
      <UndoSnackbar
        message={undoBar.message}
        onUndo={undoBar.runUndo}
        onDismiss={() => settleUndo()}
      />
    </TodaySettledContext.Provider>
  );
}

const NO_IDS: readonly string[] = [];

/** The `+`: a 44pt target with no text in it, so its box is fixed. */
const ADD_BUTTON = 44;

const styles = StyleSheet.create({
  addButton: {
    margin: 0,
    width: ADD_BUTTON,
    height: ADD_BUTTON,
  },
  emptyState: {
    marginBottom: space.xl,
  },
  /** The todos with no heading over them still stand a section clear of the day. */
  unlabelledSection: {
    marginTop: SECTION_TOP_GAP,
  },
});
