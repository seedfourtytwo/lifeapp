import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { rowKindColour } from '../../kinds/rowKind';
import type { ElementDefinition } from '../../protocol';
import CounterCard from '../counters/CounterCard';
import HabitCard from '../habits/HabitCard';
import type { DraggableRenderContext } from '../shared/DraggableTrackerList';
import TodoRow from '../todos/TodoRow';
import { DoneHabitRow, DoneRow } from './DoneRows';
import type { TodayCounters } from './useTodayCounters';
import type { TodayHabits } from './useTodayHabits';
import type { TodayTodos } from './useTodayTodos';
import type { PendingUndo } from './useUndoBar';

type Options = {
  habits: TodayHabits;
  counters: TodayCounters;
  todos: TodayTodos;
  today: string;
  /** Trackers with a note today; the card shows its note button for these. */
  notesToday: ReadonlyMap<string, string>;
  /** Stable. Opens today's note for a habit or counter. */
  openNote: (element: ElementDefinition, dictate: boolean) => void;
  /** Stable. The page's undo bar. */
  offerUndo: (next: PendingUndo) => void;
};

/** The drag wiring a row takes; none of it when the row cannot be reordered. */
function reorderProps(drag: DraggableRenderContext | undefined, hint: string) {
  const canReorder = drag?.canDrag ?? false;
  return {
    onLongPressReorder: canReorder ? drag?.onLongPress : undefined,
    onReorderTouchMove: canReorder ? drag?.onTouchMove : undefined,
    onReorderTouchEnd: canReorder ? drag?.onTouchEnd : undefined,
    onReorderTouchCancel: canReorder ? drag?.onTouchCancel : undefined,
    delayLongPressReorder: drag?.delayLongPress,
    reorderHint: canReorder ? hint : undefined,
  };
}

/**
 * How each kind of row on Today is drawn. A habit, counter or todo still in
 * play is a tile with its control; anything settled is written on the page.
 *
 * The cards are memoised and read their own slice of the stores, so every prop
 * handed over here is stable or changes only for the row it concerns. A habit
 * rendered without a `drag` context is parked: Now rows are placed by what
 * they are, not by hand.
 */
export function useTodayRows({
  habits,
  counters,
  todos,
  today,
  notesToday,
  openNote,
  offerUndo,
}: Options) {
  const { t: tTrackers } = useTranslation('trackers');
  const { t: tTodos } = useTranslation('todos');

  const offerHabitUndo = useCallback(
    (message: string, undo: () => Promise<void>) => offerUndo({ message, undo }),
    [offerUndo],
  );

  const habitHint = tTrackers('habitWidget.reorderLongPressHint');
  const { byId: habitById, configs: habitConfigs } = habits;
  const renderHabit = useCallback(
    (id: string, drag?: DraggableRenderContext) => {
      const habit = habitById.get(id);
      const config = habitConfigs.get(id);
      if (!habit || !config) return null;
      return (
        <HabitCard
          habit={habit}
          config={config}
          {...reorderProps(drag, habitHint)}
          onOfferUndo={offerHabitUndo}
          hasTodayNote={notesToday.has(id)}
          onOpenNote={openNote}
        />
      );
    },
    [habitById, habitConfigs, habitHint, notesToday, offerHabitUndo, openNote],
  );

  const renderDoneHabit = useCallback(
    (id: string) => {
      const habit = habitById.get(id);
      const config = habitConfigs.get(id);
      if (!habit || !config) return null;
      return <DoneHabitRow habit={habit} config={config} onOfferUndo={offerHabitUndo} />;
    },
    [habitById, habitConfigs, offerHabitUndo],
  );

  const counterHint = tTrackers('counterWidget.reorderLongPressHint');
  const {
    byId: counterById,
    configs: counterConfigs,
    onLog,
    onSetDailyTotal,
    onSkipToday,
    onOpenDetails,
  } = counters;
  const renderCounter = useCallback(
    (id: string, drag: DraggableRenderContext) => {
      const element = counterById.get(id);
      const config = counterConfigs.get(id);
      if (!element || !config) return null;
      return (
        <CounterCard
          element={element}
          config={config}
          {...reorderProps(drag, counterHint)}
          onLog={onLog}
          onSetDailyTotal={onSetDailyTotal}
          onSkipToday={onSkipToday}
          onOpenDetails={onOpenDetails}
          hasTodayNote={notesToday.has(id)}
          onOpenNote={openNote}
        />
      );
    },
    [
      counterById,
      counterConfigs,
      counterHint,
      notesToday,
      onLog,
      onOpenDetails,
      onSetDailyTotal,
      onSkipToday,
      openNote,
    ],
  );

  const todoHint = tTodos('list.reorderHint');
  const { open, doneToday, onOpen, onFinish, onReopen } = todos;
  const openTodoById = useMemo(() => new Map(open.map((todo) => [todo.id, todo])), [open]);
  const renderOpenTodo = useCallback(
    (id: string, drag: DraggableRenderContext) => {
      const todo = openTodoById.get(id);
      if (!todo) return null;
      return (
        <TodoRow
          todo={todo}
          today={today}
          onToggle={onFinish}
          onOpen={onOpen}
          lifted={drag.isDragging}
          {...reorderProps(drag, todoHint)}
        />
      );
    },
    [onFinish, onOpen, openTodoById, today, todoHint],
  );

  const doneTodoById = useMemo(
    () => new Map(doneToday.map((todo) => [todo.id, todo])),
    [doneToday],
  );
  /** Ticked today: the mark reopens it. Not editable from here — it is finished. */
  const renderDoneTodo = useCallback(
    (id: string) => {
      const todo = doneTodoById.get(id);
      if (!todo) return null;
      return (
        <DoneRow
          mark="done"
          kind={rowKindColour({ kind: 'todo' })}
          name={todo.title}
          onPressMark={() => onReopen(todo)}
          markLabel={tTodos('row.undoneA11y', { title: todo.title })}
        />
      );
    },
    [doneTodoById, onReopen, tTodos],
  );

  return { renderHabit, renderDoneHabit, renderCounter, renderOpenTodo, renderDoneTodo };
}
