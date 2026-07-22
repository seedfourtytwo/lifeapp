import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  formatHabitTimerDuration,
  hasHabitTimerSound,
  isActiveTimerPaused,
  isHabitDayComplete,
  liveTimerTotalSeconds,
  type HabitConfig,
} from '../../protocol';
import { getCounterProgressBarColors } from '../../utils/color';
import { shouldPlayHabitCompletionChime } from '../../utils/habitCompletionChime';
import { getTargetProgressCardBackground } from '../../utils/progressCardStyle';
import type { WidgetProps } from '../types';
import { HabitStreakBadge } from './HabitStreakBadge';
import { habitWidgetStyles as styles } from './habitWidgetStyles';

export function HabitTimerWidget({
  element,
  config,
  todayTotal,
  streak,
  failureStreak,
  activeTimerSession,
  onTimerPress,
  onTimerFinish,
  onResetToday,
  onOpenDetails,
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

  const todayTotalRef = useRef(todayTotal);
  todayTotalRef.current = todayTotal;

  // Only reset on a new session (startedAt). Pause/resume mutates the session
  // object and must not re-arm the completion chime.
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
    // Chime only while the timer is actively running past the target — not on
    // Pause/Done (Done clears the session; Pause must not re-fire).
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

  const progress = hasTarget ? Math.min(1, displayTotal / dailyTarget) : 0;
  const canResetToday = isRunning || displayTotal > 0;

  const progressBarColors = getCounterProgressBarColors(themeMode);
  const cardBackground = getTargetProgressCardBackground({
    themeMode,
    progress,
    hasTarget,
    isCartoon,
    fallbackColor: theme.colors.surface,
  });

  const totalLabel = hasTarget
    ? `${formatHabitTimerDuration(displayTotal)} / ${formatHabitTimerDuration(dailyTarget)}`
    : formatHabitTimerDuration(displayTotal);

  return (
    <Card
      style={[
        styles.card,
        {
          borderRadius: deco.radius.md,
          borderWidth: isCartoon ? deco.cardBorderWidth : 0,
          borderColor: theme.colors.outline,
          backgroundColor: cardBackground ?? theme.colors.surface,
        },
      ]}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.timerHeader}>
          <Pressable
            onPress={onOpenDetails}
            disabled={!onOpenDetails}
            style={({ pressed }) => [
              styles.timerTitle,
              pressed && onOpenDetails && styles.pressed,
            ]}
          >
            <View style={styles.titleLeading}>
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[styles.name, isCartoon && { color: theme.colors.onSurface }]}
              >
                {element.name}
              </Text>
            </View>
            <HabitStreakBadge config={config} streak={streak} failureStreak={failureStreak} />
          </Pressable>
          <View style={styles.timerTotalCluster}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[
                styles.timerTotal,
                {
                  color: isCartoon
                    ? theme.colors.onSecondaryContainer
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {totalLabel}
            </Text>
            {onResetToday ? (
              <IconButton
                icon="backup-restore"
                size={16}
                onPress={() => void onResetToday()}
                disabled={!canResetToday}
                accessibilityLabel="Reset today"
                style={[
                  styles.resetButton,
                  !canResetToday && styles.resetButtonHidden,
                ]}
                hitSlop={8}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.timerControls}>
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
            style={[styles.timerButton, { borderRadius: deco.buttonRadius }]}
            buttonColor={isCartoon ? theme.colors.primary : undefined}
            contentStyle={styles.timerButtonContent}
          >
            {!isRunning ? 'Start' : isPaused ? 'Resume' : 'Pause'}
          </Button>
          {isRunning && onTimerFinish ? (
            <Button
              mode="outlined"
              icon="check"
              onPress={() => void onTimerFinish()}
              style={[styles.finishButton, { borderRadius: deco.buttonRadius }]}
              compact
            >
              Done
            </Button>
          ) : null}
        </View>

        {hasTarget ? (
          <ProgressBar
            progress={progress}
            color={isComplete ? progressBarColors.complete : progressBarColors.active}
            style={[
              styles.progressBar,
              {
                height: deco.progressHeight,
                borderRadius: deco.progressHeight / 2,
              },
            ]}
          />
        ) : null}
      </Card.Content>
    </Card>
  );
}
