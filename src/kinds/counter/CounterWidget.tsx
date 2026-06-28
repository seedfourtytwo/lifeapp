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
import { formatCounterUnit, type CounterConfig } from '../../protocol';
import { counterProgressBar, counterProgressColors, lerpHex } from '../../utils/color';
import type { WidgetProps } from '../types';

export function CounterWidget({
  element,
  config,
  todayTotal,
  yesterdayTotal = 0,
  onLog,
  onSetDailyTotal,
  onOpenDetails,
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? Math.min(1, todayTotal / dailyTarget) : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;
  const remaining = hasTarget ? Math.max(0, dailyTarget - todayTotal) : 0;
  const unitLabel = formatCounterUnit(todayTotal, config.unit);

  const progressPalette = theme.dark
    ? counterProgressColors.dark
    : counterProgressColors.light;
  const cardBackground = hasTarget
    ? lerpHex(progressPalette.start, progressPalette.end, progress)
    : undefined;

  const statsText = hasTarget
    ? `${todayTotal} / ${dailyTarget} ${formatCounterUnit(dailyTarget, config.unit)} · ${
        isComplete ? 'Goal reached!' : `${remaining} to go`
      }`
    : `${todayTotal} ${unitLabel}`;

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
      <Card style={[styles.card, cardBackground ? { backgroundColor: cardBackground } : null]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.topRow}>
            <Pressable
              onPress={onOpenDetails}
              disabled={!onOpenDetails}
              style={({ pressed }) => [
                styles.namePress,
                pressed && onOpenDetails && styles.namePressed,
              ]}
            >
              <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
                {element.name}
              </Text>
            </Pressable>
            <View style={styles.incrementRow}>
              {config.quickIncrements.map((increment) => (
                <Button
                  key={increment}
                  mode="contained"
                  compact
                  onPress={() => void onLog(increment, { source: 'quick_button', increment })}
                  style={styles.incButton}
                  labelStyle={styles.incLabel}
                  contentStyle={styles.incContent}
                >
                  +{increment}
                </Button>
              ))}
            </View>
          </View>

          {yesterdayTotal > 0 ? (
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={[styles.yesterday, { color: theme.colors.onSurfaceVariant }]}
            >
              Yesterday · {yesterdayTotal} {formatCounterUnit(yesterdayTotal, config.unit)}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[styles.statsText, { color: theme.colors.onSurfaceVariant }]}
            >
              {statsText}
            </Text>
            {onSetDailyTotal ? (
              <IconButton
                icon="pencil-outline"
                size={16}
                onPress={openEdit}
                accessibilityLabel="Edit today's total"
                style={styles.editButton}
              />
            ) : null}
          </View>

          {hasTarget ? (
            <ProgressBar
              progress={progress}
              color={isComplete ? counterProgressBar.complete : counterProgressBar.active}
              style={styles.progressBar}
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
    marginBottom: 10,
  },
  cardContent: {
    paddingVertical: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  incrementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  incButton: {
    minWidth: 0,
    margin: 0,
  },
  incContent: {
    paddingHorizontal: 2,
  },
  incLabel: {
    fontSize: 12,
    marginVertical: 2,
    marginHorizontal: 6,
  },
  yesterday: {
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  statsText: {
    flex: 1,
    minWidth: 0,
  },
  editButton: {
    margin: 0,
    marginRight: -8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
});
