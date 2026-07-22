import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Divider,
  IconButton,
  Modal,
  Portal,
  ProgressBar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { type CounterConfig, formatCounterUnit } from '../../protocol';
import {
  getCounterProgressBarColors,
} from '../../utils/color';
import { getTargetProgressCardBackground } from '../../utils/progressCardStyle';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { WidgetProps } from '../types';

export function CounterWidget({
  element,
  config,
  todayTotal,
  onLog,
  onSetDailyTotal,
  onOpenDetails,
  onDictateNote,
  onEditNote,
  hasTodayNote,
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const sheetWidth = Math.min(width - 24, 400);

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? Math.min(1, todayTotal / dailyTarget) : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;

  const progressBarColors = getCounterProgressBarColors(themeMode);
  const cardBackground = getTargetProgressCardBackground({
    themeMode,
    progress,
    hasTarget,
    isCartoon,
    fallbackColor: theme.colors.surface,
  });

  const countText = hasTarget
    ? `${todayTotal} / ${dailyTarget} ${formatCounterUnit(dailyTarget, config.unit)}`
    : `${todayTotal} ${formatCounterUnit(todayTotal, config.unit)}`;

  const closeEdit = () => {
    if (saving) return;
    setEditVisible(false);
  };

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
    setSaving(true);
    try {
      await onSetDailyTotal?.(total);
      setEditVisible(false);
    } catch (error) {
      Alert.alert(
        'Could not update',
        error instanceof Error ? error.message : 'Try again',
      );
    } finally {
      setSaving(false);
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

          <View style={styles.incrementRow}>
            {config.quickIncrements.map((increment) => (
              <Button
                key={increment}
                mode="contained"
                onPress={() => onLog?.(increment, { source: 'quick_button', increment })}
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
        <Modal
          visible={editVisible}
          onDismiss={closeEdit}
          contentContainerStyle={[styles.modalContainer, { width: sheetWidth }]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: deco.radius.lg,
                  ...(isCartoon && {
                    borderWidth: deco.cardBorderWidth,
                    borderColor: theme.colors.outline,
                  }),
                },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text
                  variant="titleLarge"
                  style={[styles.sheetTitle, isCartoon && { color: theme.colors.onSurface }]}
                >
                  Edit today&apos;s total
                </Text>
                <IconButton
                  icon="close"
                  onPress={closeEdit}
                  disabled={saving}
                  accessibilityLabel="Close"
                />
              </View>

              <View style={styles.sheetBody}>
                <Text
                  variant="bodySmall"
                  style={[styles.sheetHint, { color: theme.colors.onSurfaceVariant }]}
                >
                  Replaces today&apos;s logged {config.unit} with a single total.
                </Text>
                <TextInput
                  label={`Total (${config.unit})`}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="number-pad"
                  mode="outlined"
                  autoFocus
                  selectTextOnFocus
                />
              </View>

              <Divider />

              <View style={styles.sheetFooter}>
                <Button onPress={closeEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void saveEdit()}
                  loading={saving}
                  disabled={saving}
                  buttonColor={isCartoon ? theme.colors.primary : undefined}
                  style={{ borderRadius: deco.buttonRadius }}
                >
                  Save
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    flexShrink: 1,
    maxWidth: '58%',
    gap: 0,
  },
  countText: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  editButton: {
    margin: 0,
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
  modalContainer: {
    alignSelf: 'center',
    marginHorizontal: 12,
  },
  keyboardAvoid: {
    flexGrow: 0,
  },
  sheet: {
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 4,
    paddingTop: 4,
  },
  sheetTitle: {
    flex: 1,
    paddingRight: 8,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  sheetHint: {
    lineHeight: 18,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
});
