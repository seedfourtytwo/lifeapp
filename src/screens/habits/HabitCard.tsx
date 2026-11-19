import { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type GestureResponderEvent } from 'react-native';
import { notify } from '../../components/sheet/confirm';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import { getKindHandler } from '../../kinds/registry';
import type { RootStackParamList } from '../../navigation/types';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { isRunningInWidget, isSkippedToday, useEventStore } from '../../store/eventStore';

type Props = {
  habit: ElementDefinition;
  config: HabitConfig;
  hasTodayNote?: boolean;
  /** Open today's note for this habit; `dictate` starts the mic. Pass a stable callback. */
  onOpenNote?: (habit: ElementDefinition, dictate: boolean) => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
  /** Offer Undo for something this card just did, e.g. clearing today's time. */
  onOfferUndo?: (message: string, undo: () => Promise<void>) => void;
};

/**
 * One habit row on Home. Reads its own slice of the event store and is memoised,
 * so a tick re-renders this card only — give it stable callbacks.
 */
function HabitCard({
  habit,
  config,
  hasTodayNote,
  onOpenNote,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
  onOfferUndo,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { handleTimerPress, handleFinishTimer, handleResetToday } = useHabitTimerControls();
  const {
    todayTotal,
    isDone,
    streak,
    score,
    skipped,
    activeTimerSession,
    runningInWidget,
    toggleHabit,
    setSkipToday,
  } = useEventStore(
    useShallow((state) => ({
      todayTotal: state.dailyTotals[habit.id] ?? 0,
      isDone: state.habitDoneToday[habit.id] ?? false,
      streak: state.habitStreaks[habit.id] ?? 0,
      score: state.habitScores[habit.id] ?? 0,
      skipped: isSkippedToday(state, habit.id, state.habitDoneToday[habit.id] ?? false),
      activeTimerSession: state.activeTimerSessions[habit.id] ?? null,
      runningInWidget: isRunningInWidget(state, habit.id),
      toggleHabit: state.toggleHabit,
      setSkipToday: state.setSkipToday,
    })),
  );

  const skipToday = (skip: boolean) => {
    const tracker = { kind: 'habit' as const, config };
    setSkipToday(habit.id, tracker, skip)
      .then(() => {
        if (!skip) return;
        onOfferUndo?.(t('undo.skipped', { name: habit.name }), () =>
          setSkipToday(habit.id, tracker, false),
        );
      })
      .catch((error) => {
        notify({
          title: t('skip.couldNotSkipTitle'),
          message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
        });
      });
  };

  const habitHandler = getKindHandler('habit');
  if (!habitHandler) return null;

  const Widget = habitHandler.DashboardWidget;

  return (
    <Widget
      element={habit}
      config={config}
      todayTotal={todayTotal}
      isDone={isDone}
      streak={streak}
      score={score}
      skipped={skipped}
      onSkipToday={skipToday}
      activeTimerSession={activeTimerSession}
      runningInWidget={runningInWidget}
      hasTodayNote={hasTodayNote}
      onDictateNote={onOpenNote ? () => onOpenNote(habit, true) : undefined}
      onEditNote={onOpenNote ? () => onOpenNote(habit, false) : undefined}
      onLongPressReorder={onLongPressReorder}
      delayLongPressReorder={delayLongPressReorder}
      onReorderTouchMove={onReorderTouchMove}
      onReorderTouchEnd={onReorderTouchEnd}
      onReorderTouchCancel={onReorderTouchCancel}
      reorderHint={reorderHint}
      onToggle={() =>
        toggleHabit(habit.id, config).catch((error) => {
          notify({
            title: t('habitWidget.couldNotUpdateTitle'),
            message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          });
        })
      }
      onTimerPress={() => handleTimerPress(habit.id, config)}
      onTimerFinish={async () => {
        // Open-ended Done anytime; seconds-target Done after goal (banks overtime).
        // play_once natural end sets trackCompleted elsewhere — false here.
        try {
          await handleFinishTimer(habit.id, config, false);
        } catch (error) {
          notify({
            title: t('habitWidget.couldNotFinishTimerTitle'),
            message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          });
          throw error;
        }
      }}
      onResetToday={() =>
        handleResetToday(habit.id, config)
          .then((undo) =>
            onOfferUndo?.(t('undo.timerReset', { name: habit.name }), undo),
          )
          .catch((error) => {
          notify({
            title: t('habitWidget.couldNotResetTodayTitle'),
            message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
          });
        })
      }
      onOpenDetails={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
}

export default memo(HabitCard);
