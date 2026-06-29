import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  formatHabitDescription,
  formatHabitTimerDuration,
  isHabitDayComplete,
  liveTimerTotalSeconds,
  type HabitConfig,
} from '../../protocol';
import {
  getCounterProgressBarColors,
  getCounterProgressPalette,
  lerpHex,
} from '../../utils/color';
import type { WidgetProps } from '../types';

function BooleanHabitWidget({
  element,
  config,
  isDone,
  onToggle,
  onOpenDetails,
  streak,
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const description = formatHabitDescription(config);

  return (
    <Card
      style={[
        styles.card,
        {
          borderRadius: deco.radius.md,
          borderWidth: isCartoon ? deco.cardBorderWidth : deco.borderWidth,
          borderColor: isCartoon ? theme.colors.outline : theme.colors.outlineVariant,
          backgroundColor: isCartoon ? theme.colors.surface : theme.colors.surfaceVariant,
          opacity: isDone ? 0.65 : 1,
        },
      ]}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.row}>
          <Checkbox
            status={isDone ? 'checked' : 'unchecked'}
            onPress={() => void onToggle?.()}
          />
          <Pressable
            onPress={onOpenDetails}
            disabled={!onOpenDetails}
            style={({ pressed }) => [
              styles.body,
              pressed && onOpenDetails && styles.pressed,
            ]}
          >
            <View style={styles.titleRow}>
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[styles.name, isCartoon && { color: theme.colors.onSurface }]}
              >
                {element.name}
              </Text>
              {streak && streak > 0 ? (
                <Text variant="labelSmall" style={styles.streak}>
                  {streak} day{streak === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
            {description ? (
              <Text variant="bodySmall" style={styles.description} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </Card.Content>
    </Card>
  );
}

function TimerHabitWidget({
  element,
  config,
  todayTotal,
  streak,
  activeTimerSession,
  onStartTimer,
  onStopTimer,
  onOpenDetails,
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [, setTick] = useState(0);
  const isRunning = Boolean(activeTimerSession);
  const dailyTarget = config.dailyTargetSeconds;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning, activeTimerSession?.startedAt]);

  const displayTotal = liveTimerTotalSeconds(todayTotal, activeTimerSession);
  const isComplete = isHabitDayComplete(displayTotal, config);
  const progress = hasTarget ? Math.min(1, displayTotal / dailyTarget) : 0;

  const progressPalette = getCounterProgressPalette(themeMode);
  const progressBarColors = getCounterProgressBarColors(themeMode);
  const cardBackground = hasTarget
    ? lerpHex(progressPalette.start, progressPalette.end, progress)
    : isCartoon
      ? theme.colors.surface
      : undefined;

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
            <Text
              variant="titleSmall"
              numberOfLines={1}
              style={[styles.name, isCartoon && { color: theme.colors.onSurface }]}
            >
              {element.name}
            </Text>
            {streak && streak > 0 ? (
              <Text variant="labelSmall" style={styles.streak}>
                {streak} day{streak === 1 ? '' : 's'}
              </Text>
            ) : null}
          </Pressable>
          <Text
            variant="bodyMedium"
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
        </View>

        <Button
          mode="contained"
          icon={isRunning ? 'stop' : config.soundId ? 'play-circle' : 'play'}
          onPress={() => void (isRunning ? onStopTimer?.() : onStartTimer?.())}
          style={[styles.timerButton, { borderRadius: deco.buttonRadius }]}
          buttonColor={isCartoon ? theme.colors.primary : undefined}
        >
          {isRunning ? 'Stop' : 'Start'}
        </Button>

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

export function HabitWidget(props: WidgetProps<HabitConfig>) {
  if (props.config.trackingMode === 'timer') {
    return <TimerHabitWidget {...props} />;
  }
  return <BooleanHabitWidget {...props} />;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 6,
  },
  cardContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerTitle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  streak: {
    marginTop: 2,
    opacity: 0.7,
    fontWeight: '600',
  },
  description: {
    marginTop: 2,
    opacity: 0.6,
  },
  timerTotal: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    flexShrink: 0,
  },
  timerButton: {
    marginTop: 0,
  },
  progressBar: {
    marginTop: 0,
  },
});
