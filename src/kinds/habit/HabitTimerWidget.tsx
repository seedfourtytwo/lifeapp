import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import {
  formatHabitHomeTimerLabel,
  getHabitTimerEffectiveTargetSeconds,
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
  isActiveTimerPaused,
  isHabitDayComplete,
  liveTimerTotalSeconds,
  type HabitConfig,
} from '../../protocol';
import { shouldPlayHabitCompletionChime } from '../../utils/habitCompletionChime';
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
  config,
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
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [, setTick] = useState(0);
  const [resetBubblesOpen, setResetBubblesOpen] = useState(false);
  const loggedTotalAtSessionStart = useRef(todayTotal);
  const chimePlayedRef = useRef(false);
  const isRunning = Boolean(activeTimerSession);
  const isPaused = isActiveTimerPaused(activeTimerSession);
  const effectiveTarget = getHabitTimerEffectiveTargetSeconds(config);
  const hasCompletionTarget = effectiveTarget !== undefined && effectiveTarget > 0;
  const hasSecondsTarget =
    config.dailyTargetSeconds !== undefined && config.dailyTargetSeconds > 0;
  const isPlayOnceTarget =
    !hasSecondsTarget &&
    hasHabitTimerSound(config.timerSound) &&
    getHabitTimerPlaybackMode(config.timerSound) === 'play_once';
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
  // play_once without a seconds goal: only store "track finished" counts as done.
  // Seconds goals use live total so the wash/colors update during the session.
  const isComplete = isPlayOnceTarget
    ? Boolean(isDone)
    : isHabitDayComplete(displayTotal, config);

  /**
   * Done banks/stops a session:
   * - Open-ended: anytime while running
   * - Seconds target: only after the goal is reached (keep going for overtime,
   *   then Done to save). Under target: Play/Pause only; Reset clears the day.
   * - play_once track goal: never — only natural track end completes.
   */
  const secondsTarget = config.dailyTargetSeconds ?? 0;
  const showManualDone =
    isRunning &&
    Boolean(onTimerFinish) &&
    (!hasCompletionTarget || (hasSecondsTarget && displayTotal >= secondsTarget));

  useEffect(() => {
    if (!hasSecondsTarget || !isRunning || isPaused || chimePlayedRef.current) return;
    const previousTotal = loggedTotalAtSessionStart.current;
    if (
      shouldPlayHabitCompletionChime(
        config,
        previousTotal,
        displayTotal,
        [],
        [{ value: displayTotal - previousTotal, meta: undefined }],
      )
    ) {
      chimePlayedRef.current = true;
      void playHabitCompleteChime();
    }
  }, [config, displayTotal, hasSecondsTarget, isPaused, isRunning]);

  const progress = hasCompletionTarget && effectiveTarget ? displayTotal / effectiveTarget : 0;
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
          progress={hasCompletionTarget ? progress : null}
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
              accessibilityLabel={t('habitWidget.finishSessionA11y')}
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
