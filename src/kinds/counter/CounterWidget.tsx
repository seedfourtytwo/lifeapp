import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Icon, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import type { CounterConfig } from '../../protocol';
import type { WidgetProps } from '../types';

export function CounterWidget({
  element,
  config,
  todayTotal,
  onLog,
  onUndo,
  onSetDailyTotal,
  onOpenDetails,
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');

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

  const handleUndo = async () => {
    try {
      await onUndo?.();
    } catch (error) {
      Alert.alert(
        'Could not undo',
        error instanceof Error ? error.message : 'Try again',
      );
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <Card.Content>
          <Pressable
            onPress={onOpenDetails}
            disabled={!onOpenDetails}
            style={styles.titleRow}
          >
            <Text variant="titleMedium" style={styles.titleFlex}>
              {element.name}
            </Text>
            {onOpenDetails ? (
              <Icon source="chart-bar" size={22} color={theme.colors.primary} />
            ) : null}
          </Pressable>
          <Text variant="bodySmall" style={styles.tapHint}>
            {onOpenDetails ? 'Tap name for history' : null}
          </Text>
          <Text variant="displaySmall" style={styles.total}>
            {todayTotal} {config.unit}
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Today
          </Text>
          <View style={styles.buttons}>
            {config.quickIncrements.map((increment) => (
              <Button
                key={increment}
                mode="contained"
                onPress={() => void onLog(increment, { source: 'quick_button', increment })}
                style={styles.button}
              >
                +{increment}
              </Button>
            ))}
          </View>
          <View style={styles.adjustRow}>
            <Button
              mode="outlined"
              onPress={() => void handleUndo()}
              disabled={todayTotal === 0 || !onUndo}
              style={styles.adjustButton}
            >
              Undo last
            </Button>
            <Button
              mode="outlined"
              onPress={openEdit}
              disabled={!onSetDailyTotal}
              style={styles.adjustButton}
            >
              Edit total
            </Button>
          </View>
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
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleFlex: {
    flex: 1,
  },
  tapHint: {
    opacity: 0.45,
    marginTop: 2,
    marginBottom: 4,
    minHeight: 16,
  },
  total: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexGrow: 1,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  adjustButton: {
    flex: 1,
  },
});
