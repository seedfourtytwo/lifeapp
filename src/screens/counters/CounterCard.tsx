import { memo } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { getKindHandler } from '../../kinds/registry';
import type { CounterConfig, ElementDefinition } from '../../protocol';
import { isSkippedToday, useEventStore } from '../../store/eventStore';

type Props = {
  element: ElementDefinition;
  config: CounterConfig;
  hasTodayNote?: boolean;
  onLog: (
    element: ElementDefinition,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  onSetDailyTotal: (element: ElementDefinition, total: number) => Promise<void>;
  /** Skip today (`true`) or undo it. Only offered with a daily target. */
  onSkipToday: (element: ElementDefinition, config: CounterConfig, skip: boolean) => void;
  onOpenDetails: (element: ElementDefinition) => void;
  /** Open today's note for this counter; `dictate` starts the mic. */
  onOpenNote: (element: ElementDefinition, dictate: boolean) => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
};

/**
 * One counter row on Home. Reads its own total and streak from the event store
 * and is memoised, so a +1 here (or a habit tick, which also writes
 * `dailyTotals`) re-renders this card only — give it stable callbacks.
 */
function CounterCard({
  element,
  config,
  hasTodayNote,
  onLog,
  onSetDailyTotal,
  onSkipToday,
  onOpenDetails,
  onOpenNote,
  onLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  delayLongPressReorder,
  reorderHint,
}: Props) {
  const target = config.dailyTarget ?? 0;
  const { todayTotal, streak, score, skipped } = useEventStore(
    useShallow((state) => {
      const total = state.dailyTotals[element.id] ?? 0;
      return {
        todayTotal: total,
        streak: state.counterStreaks[element.id] ?? 0,
        score: state.counterScores[element.id] ?? 0,
        skipped: target > 0 && isSkippedToday(state, element.id, total >= target),
      };
    }),
  );

  const handler = getKindHandler(element.kind);
  if (!handler) return null;
  const Widget = handler.DashboardWidget;

  return (
    <Widget
      element={element}
      config={config}
      todayTotal={todayTotal}
      streak={streak}
      score={score}
      skipped={skipped}
      onSkipToday={target > 0 ? (skip) => onSkipToday(element, config, skip) : undefined}
      onLongPressReorder={onLongPressReorder}
      delayLongPressReorder={delayLongPressReorder}
      onReorderTouchMove={onReorderTouchMove}
      onReorderTouchEnd={onReorderTouchEnd}
      onReorderTouchCancel={onReorderTouchCancel}
      reorderHint={reorderHint}
      onLog={(value, meta) => onLog(element, value, meta)}
      onSetDailyTotal={(total) => onSetDailyTotal(element, total)}
      onOpenDetails={() => onOpenDetails(element)}
      hasTodayNote={hasTodayNote}
      onDictateNote={() => onOpenNote(element, true)}
      onEditNote={() => onOpenNote(element, false)}
    />
  );
}

export default memo(CounterCard);
