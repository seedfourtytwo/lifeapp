import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  formatHabitTimerDuration,
  getHabitTimerEffectiveTargetSeconds,
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
  isActiveTimerPaused,
  isHabitDayComplete,
  liveTimerTotalSeconds,
  type HabitConfig,
} from '../../protocol';
import { getCounterProgressBarColors } from '../../utils/color';
import { shouldPlayHabitCompletionChime } from '../../utils/habitCompletionChime';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import {
  formatHabitStreakLabel,
  getHabitStreakDays,
} from './habitCardLabels';
import { HabitCardTitle } from './HabitCardTitle';
import { NoteIconButton } from '../../notes/NoteIconButton';

const ACTION_ICON_SIZE = 30;

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
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const { themeMode, decorations: deco } = useAppTheme();
  const [, setTick] = useState(0);
  const [resetBubblesOpen, setResetBubblesOpen] = useState(false);
  const loggedTotalAtSessionStart = useRef(todayTotal);
  const chimePlayedRef = useRef(false);
  const autoFinishedSessionRef = useRef<string | null>(null);
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
  /**
   * Done logs the open session. Hidden for play_once — only a natural track end
   * may set trackCompleted. Seconds-target timers keep Done so users can stop early
   * and still keep progress (auto-finish still runs when the target is crossed).
   */
  const showManualDone = isRunning && Boolean(onTimerFinish) && !isPlayOnceTarget;
  const streakDays = getHabitStreakDays(config, streak);
  const streakLabel = formatHabitStreakLabel(config, streak);

  const todayTotalRef = useRef(todayTotal);
  todayTotalRef.current = todayTotal;

  useEffect(() => {
    if (!activeTimerSession?.startedAt) return;
    loggedTotalAtSessionStart.current = todayTotalRef.current;
    chimePlayedRef.current = false;
    autoFinishedSessionRef.current = null;
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

  // Seconds target: auto-finish only when this session crosses the target
  // (not when today was already complete before play).
  useEffect(() => {
    if (!hasSecondsTarget || !isRunning || isPaused || !onTimerFinish) return;
    const target = config.dailyTargetSeconds;
    if (!target) return;
    const previousTotal = loggedTotalAtSessionStart.current;
    if (previousTotal >= target || displayTotal < target) return;
    const sessionKey = activeTimerSession?.startedAt ?? '';
    if (!sessionKey || autoFinishedSessionRef.current === sessionKey) return;
    autoFinishedSessionRef.current = sessionKey;
    void Promise.resolve(onTimerFinish()).catch(() => {
      // Allow another attempt if finish failed (session may still be running).
      if (autoFinishedSessionRef.current === sessionKey) {
        autoFinishedSessionRef.current = null;
      }
    });
  }, [
    activeTimerSession?.startedAt,
    config.dailyTargetSeconds,
    displayTotal,
    hasSecondsTarget,
    isPaused,
    isRunning,
    onTimerFinish,
  ]);

  const progress = hasCompletionTarget && effectiveTarget ? displayTotal / effectiveTarget : 0;
  const canResetToday = Boolean(onResetToday) && (isRunning || displayTotal > 0);
  const progressBarColors = getCounterProgressBarColors(themeMode);

  const totalLabel =
    hasCompletionTarget && effectiveTarget
      ? `${formatHabitTimerDuration(displayTotal)} / ${formatHabitTimerDuration(effectiveTarget)}`
      : formatHabitTimerDuration(displayTotal);

  const metaColor = isComplete
    ? theme.colors.primary
    : theme.colors.onSurfaceVariant;

  const playIcon = !isRunning
    ? 'play-circle'
    : isPaused
      ? 'play-circle'
      : 'pause-circle';

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
    <TrackerCard
      progress={
        hasCompletionTarget
          ? {
              value: progress,
              color: isComplete
                ? progressBarColors.complete
                : progressBarColors.active,
              trackColor: theme.colors.outlineVariant,
              height: deco.progressHeight,
            }
          : null
      }
    >
      <View style={styles.oneLineRow}>
        <HabitCardTitle
          name={element.name}
          streakDays={streakDays}
          streakAccessibilityLabel={streakLabel}
          onOpenDetails={onOpenDetails}
        />

        <View style={styles.trailingCluster}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={[styles.timerLabel, { color: metaColor }]}
            accessibilityLabel={totalLabel}
          >
            {totalLabel}
          </Text>

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
            <IconButton
              icon={playIcon}
              size={ACTION_ICON_SIZE}
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
              iconColor={theme.colors.primary}
              style={styles.iconButton}
              hitSlop={4}
              accessibilityLabel={playA11y}
              accessibilityHint={
                canResetToday ? t('habitWidget.playLongPressResetHint') : undefined
              }
            />
          </ActionBubbleTray>

          {showManualDone ? (
            <IconButton
              icon="check-circle"
              size={ACTION_ICON_SIZE}
              onPress={() => void onTimerFinish?.()}
              iconColor={theme.colors.primary}
              style={styles.iconButton}
              hitSlop={4}
              accessibilityLabel={t('habitWidget.finishSessionA11y')}
            />
          ) : null}

          {onDictateNote ? (
            <NoteIconButton
              hasNote={Boolean(hasTodayNote)}
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={ACTION_ICON_SIZE - 4}
              style={styles.iconButton}
            />
          ) : null}
        </View>
      </View>
    </TrackerCard>
  );
}
