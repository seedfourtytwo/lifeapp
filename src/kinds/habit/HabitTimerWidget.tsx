import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import {
  dayOutcome,
  factsFromTotal,
  formatHabitHomeTimerLabel,
  habitTimerGoal,
  isActiveTimerPaused,
  liveTimerTotalSeconds,
  type HabitElement,
} from '../../protocol';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import { describeHabitCardSound, formatHabitStreakLabel } from './habitCardLabels';
import { HabitSoundIndicator } from './HabitSoundIndicator';
import { TrackerCardRoundButton } from '../TrackerCardRoundButton';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { NoteIconButton } from '../../notes/NoteIconButton';

const NOTE_ICON_SIZE = 24;

export function HabitTimerWidget({
  element,
  todayTotal,
  streak,
  isDone,
  activeTimerSession,
  onTimerPress,
  onTimerFinish,
  onResetToday,
  onOpenDetails,
  onDictateNote,
  onEditNote,
  hasTodayNote,
  onLongPressReorder,
  delayLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  reorderHint,
}: WidgetProps<HabitElement>) {
  const { config } = element;
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [, setTick] = useState(0);
  const [resetBubblesOpen, setResetBubblesOpen] = useState(false);
  const loggedTotalAtSessionStart = useRef(todayTotal);
  const chimePlayedRef = useRef(false);
  const isRunning = Boolean(activeTimerSession);
  const isPaused = isActiveTimerPaused(activeTimerSession);
  const goal = habitTimerGoal(config);
  const streakLabel = formatHabitStreakLabel(config, streak);
  const soundIndicator = describeHabitCardSound(config);

  const todayTotalRef = useRef(todayTotal);
  todayTotalRef.current = todayTotal;

  useEffect(() => {
    if (!activeTimerSession?.startedAt) return;
    loggedTotalAtSessionStart.current = todayTotalRef.current;
    chimePlayedRef.current = false;
  }, [activeTimerSession?.startedAt]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [isPaused, isRunning, activeTimerSession?.startedAt]);

  const displayTotal = liveTimerTotalSeconds(todayTotal, activeTimerSession);
  /** The day as it stands this second, counting the running session's seconds. */
  const liveDone = (total: number) =>
    dayOutcome({ kind: 'habit', config }, factsFromTotal(total)).done;
  // The store knows what the seconds cannot (a finished track, a manual Done);
  // the live total turns the card done the moment a running timer reaches its goal.
  const live = dayOutcome({ kind: 'habit', config }, factsFromTotal(displayTotal));
  const isComplete = Boolean(isDone) || (isRunning && live.done);
  const effectiveTarget = live.target;

  /**
   * Done is there whenever a timer runs or is paused, and on a day with time
   * logged that is not done yet. It banks the session's seconds; short of the
   * goal (or before a play-once track ends) it also marks today done.
   */
  const showManualDone =
    Boolean(onTimerFinish) && (isRunning || (displayTotal > 0 && !isComplete));
  const doneMarksDay = !isComplete;

  // The track's own end chimes a play-once habit; a seconds goal chimes here, live.
  useEffect(() => {
    if (goal.type !== 'seconds' || !isRunning || isPaused || chimePlayedRef.current) return;
    if (!liveDone(loggedTotalAtSessionStart.current) && live.done) {
      chimePlayedRef.current = true;
      void playHabitCompleteChime();
    }
  });

  const progress = effectiveTarget !== undefined ? displayTotal / effectiveTarget : 0;
  const canResetToday = Boolean(onResetToday) && (isRunning || displayTotal > 0);

  /** Idle + zero today: show target only (or hide for open-ended). Elapsed appears once started. */
  const totalLabel = formatHabitHomeTimerLabel({
    displayTotal,
    effectiveTargetSeconds: effectiveTarget,
    isRunning,
  });

  const metaColor = isComplete
    ? theme.colors.primary
    : theme.colors.onSurfaceVariant;

  const playIcon = isRunning && !isPaused ? 'pause' : 'play';

  const playA11y = !isRunning
    ? t('habitWidget.startTimerA11y')
    : isPaused
      ? t('habitWidget.resumeTimerA11y')
      : t('habitWidget.pauseTimerA11y');

  const closeResetBubbles = () => setResetBubblesOpen(false);

  const confirmResetToday = () => {
    void onResetToday?.();
  };

  return (
    <TrackerCard>
      <View style={styles.oneLineRow}>
        <TrackerCardTitle
          name={element.name}
          icon={config.icon}
          progress={effectiveTarget !== undefined ? progress : null}
          complete={isComplete}
          streakLabel={streakLabel}
          {...trackerCardTitleInteractions({
            onOpenDetails,
            onLongPressReorder,
            onReorderTouchMove,
            onReorderTouchEnd,
            onReorderTouchCancel,
            delayLongPressReorder,
            reorderHint,
          })}
        />

        <View style={styles.trailingCluster}>
          {soundIndicator ? (
            <HabitSoundIndicator
              indicator={soundIndicator}
              color={theme.colors.onSurfaceVariant}
            />
          ) : null}

          {totalLabel ? (
            <Text
              numberOfLines={1}
              style={[styles.timerLabel, { color: metaColor }]}
              accessibilityLabel={totalLabel}
            >
              {totalLabel}
            </Text>
          ) : null}

          <ActionBubbleTray
            open={resetBubblesOpen}
            onDismiss={closeResetBubbles}
            bubbles={
              canResetToday
                ? [
                    {
                      key: 'reset',
                      icon: 'backup-restore',
                      accessibilityLabel: t('habitWidget.resetTodayA11y'),
                      onPress: confirmResetToday,
                    },
                  ]
                : []
            }
          >
            <TrackerCardRoundButton
              icon={playIcon}
              onPress={() => {
                closeResetBubbles();
                void onTimerPress?.();
              }}
              onLongPress={
                canResetToday
                  ? () => setResetBubblesOpen((open) => !open)
                  : undefined
              }
              delayLongPress={350}
              accessibilityLabel={playA11y}
              accessibilityHint={
                canResetToday ? t('habitWidget.playLongPressResetHint') : undefined
              }
            />
          </ActionBubbleTray>

          {showManualDone ? (
            <TrackerCardRoundButton
              icon="check"
              tone="solid"
              onPress={() => void onTimerFinish?.()}
              accessibilityLabel={
                doneMarksDay
                  ? t('habitWidget.markHabitDoneA11y')
                  : t('habitWidget.finishSessionA11y')
              }
            />
          ) : null}

          {/* Only once there is a note; a first one is added from the history. */}
          {onDictateNote && hasTodayNote ? (
            <NoteIconButton
              hasNote
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={NOTE_ICON_SIZE}
              style={styles.iconButton}
            />
          ) : null}
        </View>
      </View>
    </TrackerCard>
  );
}
