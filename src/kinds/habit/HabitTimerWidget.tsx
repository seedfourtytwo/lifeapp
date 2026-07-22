import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  formatHabitDescription,
  formatHabitTimerDuration,
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
  formatHabitCardDescription,
  formatHabitStreakLabel,
} from './habitCardLabels';
import { HabitCardTitle } from './HabitCardTitle';
import { NoteIconButton } from '../../notes/NoteIconButton';

export function HabitTimerWidget({
  element,
  config,
  todayTotal,
  streak,
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
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [, setTick] = useState(0);
  const loggedTotalAtSessionStart = useRef(todayTotal);
  const chimePlayedRef = useRef(false);
  const isRunning = Boolean(activeTimerSession);
  const isPaused = isActiveTimerPaused(activeTimerSession);
  const dailyTarget = config.dailyTargetSeconds;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const description = formatHabitCardDescription(formatHabitDescription(config));
  const streakLabel = formatHabitStreakLabel(config, streak);

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
  const isComplete = isHabitDayComplete(displayTotal, config);

  useEffect(() => {
    if (!hasTarget || !isRunning || isPaused || chimePlayedRef.current) return;
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
  }, [config, displayTotal, hasTarget, isPaused, isRunning]);

  const progress = hasTarget ? displayTotal / dailyTarget : 0;
  const canResetToday = isRunning || displayTotal > 0;
  const progressBarColors = getCounterProgressBarColors(themeMode);

  const totalLabel = hasTarget
    ? `${formatHabitTimerDuration(displayTotal)} / ${formatHabitTimerDuration(dailyTarget)}`
    : formatHabitTimerDuration(displayTotal);

  const metaColor = isCartoon
    ? theme.colors.onSecondaryContainer
    : theme.colors.onSurfaceVariant;

  return (
    <TrackerCard
      progress={
        hasTarget
          ? {
              value: progress,
              color: isComplete
                ? progressBarColors.complete
                : progressBarColors.active,
              trackColor: theme.colors.surfaceVariant,
              height: deco.progressHeight,
            }
          : null
      }
    >
      <View style={styles.headerRow}>
        <HabitCardTitle
          name={element.name}
          streakLabel={streakLabel}
          description={description}
          onOpenDetails={onOpenDetails}
        />
        <View style={styles.metaCluster}>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={[styles.metaText, { color: metaColor }]}
          >
            {totalLabel}
          </Text>
          {onResetToday && canResetToday ? (
            <IconButton
              icon="backup-restore"
              size={16}
              onPress={() => void onResetToday()}
              accessibilityLabel="Reset today"
              style={styles.iconButton}
              hitSlop={8}
            />
          ) : null}
          {onDictateNote ? (
            <NoteIconButton
              hasNote={Boolean(hasTodayNote)}
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={16}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Button
          mode="contained"
          icon={
            !isRunning
              ? hasHabitTimerSound(config.timerSound)
                ? 'play-circle'
                : 'play'
              : isPaused
                ? 'play'
                : 'pause'
          }
          onPress={() => void onTimerPress?.()}
          style={[styles.primaryButton, { borderRadius: deco.buttonRadius }]}
          buttonColor={isCartoon ? theme.colors.primary : undefined}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          accessibilityLabel={
            !isRunning ? 'Start timer' : isPaused ? 'Resume timer' : 'Pause timer'
          }
        >
          {!isRunning ? 'Start' : isPaused ? 'Resume' : 'Pause'}
        </Button>
        {isRunning && onTimerFinish ? (
          <Button
            mode="contained-tonal"
            icon="check"
            onPress={() => void onTimerFinish()}
            style={[styles.finishButton, { borderRadius: deco.buttonRadius }]}
            contentStyle={styles.primaryButtonContent}
            labelStyle={styles.primaryButtonLabel}
            accessibilityLabel="Finish timer session"
          >
            Done
          </Button>
        ) : null}
      </View>
    </TrackerCard>
  );
}
