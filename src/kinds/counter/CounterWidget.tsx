import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  IconButton,
  Portal,
  ProgressBar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { type CounterConfig } from '../../protocol';
import {
  getCounterProgressBarColors,
  getCounterProgressPalette,
  lerpHex,
} from '../../utils/color';
import type { WidgetProps } from '../types';

export function CounterWidget({
  element,
  config,
  todayTotal,
  yesterdayTotal: _yesterdayTotal = 0,
  onLog,
  onSetDailyTotal,
  onOpenDetails,
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? Math.min(1, todayTotal / dailyTarget) : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;

  const progressPalette = getCounterProgressPalette(themeMode);
  const progressBarColors = getCounterProgressBarColors(themeMode);
  const cardBackground = hasTarget
    ? lerpHex(progressPalette.start, progressPalette.end, progress)
    : isCartoon
      ? theme.colors.surface
      : undefined;

  const countText = hasTarget ? `${todayTotal} / ${dailyTarget}` : String(todayTotal);

  const openEdit = () => {
    setEditValue(String(todayTotal));
    setEditVisible(true);
  };

  const saveEdit = async () => {
    const total = parseInt(editValue.trim(), 10);
    if (Number.isNaN(total) || total < 0) {
      Alert.alert('Invalid total', 'Enter a whole number zero or greater.');
      return;
    }
    try {
      await onSetDailyTotal?.(total);
      setEditVisible(false);
    } catch (error) {
      Alert.alert(
        'Could not update',
        error instanceof Error ? error.message : 'Try again',
      );
    }
  };

  return (
    <>
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
          <View style={styles.headerRow}>
            <Pressable
              onPress={onOpenDetails}
              disabled={!onOpenDetails}
              style={({ pressed }) => [
                styles.namePress,
                pressed && onOpenDetails && styles.namePressed,
              ]}
            >
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[styles.name, isCartoon && { color: theme.colors.onSurface }]}
              >
                {element.name}
              </Text>
            </Pressable>
            <View style={styles.countCluster}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={[
                  styles.countText,
                  {
                    color: isCartoon
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {countText}
              </Text>
              {onSetDailyTotal ? (
                <IconButton
                  icon="pencil-outline"
                  size={16}
                  onPress={openEdit}
                  accessibilityLabel="Edit today's total"
                  style={styles.editButton}
                  hitSlop={8}
                />
              ) : null}
            </View>
          </View>

          <View style={styles.incrementRow}>
            {config.quickIncrements.map((increment) => (
              <Button
                key={increment}
                mode="contained"
                onPress={() => void onLog(increment, { source: 'quick_button', increment })}
                style={[styles.incButton, { borderRadius: deco.buttonRadius }]}
                labelStyle={styles.incLabel}
                contentStyle={styles.incContent}
                buttonColor={isCartoon ? theme.colors.primary : undefined}
              >
                +{increment}
              </Button>
            ))}
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

      <Portal>
        <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)}>
          <Dialog.Title>Edit today&apos;s total</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={`Total (${config.unit})`}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="number-pad"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditVisible(false)}>Cancel</Button>
            <Button onPress={() => void saveEdit()}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 6,
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontWeight: '700',
  },
  namePress: {
    flex: 1,
    minWidth: 0,
  },
  namePressed: {
    opacity: 0.7,
  },
  countCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  countText: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  editButton: {
    margin: 0,
    marginRight: -8,
    width: 32,
    height: 32,
  },
  incrementRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  incButton: {
    flex: 1,
    margin: 0,
  },
  incContent: {
    minHeight: 40,
    paddingHorizontal: 4,
  },
  incLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginVertical: 0,
    marginHorizontal: 0,
  },
  progressBar: {
    marginTop: 2,
  },
});
