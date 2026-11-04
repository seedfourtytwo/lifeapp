import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  StyleSheet,
} from 'react-native';
import {
  Button,
  IconButton,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { type CounterConfig } from '../../protocol';
import { getCounterProgressBarColors } from '../../utils/color';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as cardStyles } from '../trackerCardStyles';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import {
  formatCounterStreakLabel,
  getCounterStreakDays,
} from './counterCardLabels';

const ACTION_ICON_SIZE = 30;

export function CounterWidget({
  element,
  config,
  todayTotal,
  streak,
  onLog,
  onSetDailyTotal,
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
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { width } = useWindowDimensions();
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [bubblesOpen, setBubblesOpen] = useState(false);

  const sheetWidth = Math.min(width - 24, 400);

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? todayTotal / dailyTarget : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;
  const progressBarColors = getCounterProgressBarColors(themeMode);
  const streakDays = getCounterStreakDays(config, streak);
  const streakLabel = formatCounterStreakLabel(config, streak);

  const increments = config.quickIncrements;
  const primaryIncrement = increments[0];
  const extraIncrements = increments.slice(1);
  // Setting an exact total is a tap on the count, so the tray is only for +N.
  const canShowBubbles = extraIncrements.length > 0;

  const countText = hasTarget ? `${todayTotal} / ${dailyTarget}` : `${todayTotal}`;

  const metaColor = isComplete
    ? theme.colors.primary
    : isCartoon
      ? theme.colors.onSecondaryContainer
      : theme.colors.onSurfaceVariant;

  const closeEdit = () => {
    if (saving) return;
    setEditVisible(false);
  };

  const openEdit = () => {
    setBubblesOpen(false);
    setEditValue(String(todayTotal));
    setEditVisible(true);
  };

  const saveEdit = async () => {
    const total = parseInt(editValue.trim(), 10);
    if (Number.isNaN(total) || total < 0) {
      Alert.alert(t('counterWidget.invalidTotalTitle'), t('counterWidget.invalidTotalBody'));
      return;
    }
    setSaving(true);
    try {
      await onSetDailyTotal?.(total);
      setEditVisible(false);
    } catch (error) {
      Alert.alert(
        t('counterWidget.couldNotUpdateTitle'),
        error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      );
    } finally {
      setSaving(false);
    }
  };

  const logIncrement = (increment: number) => {
    setBubblesOpen(false);
    onLog?.(increment, { source: 'quick_button', increment });
  };

  // Tonal, not a solid slab: the +1 is the row's action, not its loudest thing.
  const primaryBg = isCartoon ? theme.colors.primary : theme.colors.primaryContainer;
  const primaryFg = isCartoon ? theme.colors.onPrimary : theme.colors.onPrimaryContainer;

  const bubbles = [
    ...extraIncrements.map((increment) => ({
      key: `inc-${increment}`,
      label: `+${increment}`,
      accessibilityLabel: t('counterWidget.addIncrementA11y', { count: increment }),
      onPress: () => logIncrement(increment),
    })),
  ];

  return (
    <>
      <TrackerCard
        progress={
          hasTarget
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
        <View style={cardStyles.oneLineRow}>
          <TrackerCardTitle
            name={element.name}
            icon={config.icon}
            progress={hasTarget ? progress : null}
            complete={isComplete}
            streakDays={streakDays}
            streakAccessibilityLabel={streakLabel}
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

          <View style={cardStyles.trailingCluster}>
            <Pressable
              onPress={onSetDailyTotal ? openEdit : undefined}
              disabled={!onSetDailyTotal}
              hitSlop={space.sm}
              style={({ pressed }) => [styles.countHit, pressed && cardStyles.pressed]}
              accessibilityRole={onSetDailyTotal ? 'button' : undefined}
              accessibilityLabel={countText}
              accessibilityHint={onSetDailyTotal ? t('counterWidget.tapCountToSetHint') : undefined}
            >
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[cardStyles.timerLabel, { color: metaColor }]}
              >
                {countText}
              </Text>
            </Pressable>

            <ActionBubbleTray
              open={bubblesOpen}
              onDismiss={() => setBubblesOpen(false)}
              bubbles={bubbles}
            >
              <Pressable
                onPress={() => logIncrement(primaryIncrement)}
                onLongPress={
                  canShowBubbles
                    ? () => setBubblesOpen((open) => !open)
                    : undefined
                }
                delayLongPress={350}
                style={({ pressed }) => [
                  styles.incrementHit,
                  {
                    backgroundColor: primaryBg,
                    borderRadius: deco.buttonRadius,
                  },
                  pressed && cardStyles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('counterWidget.addIncrementA11y', {
                  count: primaryIncrement,
                })}
                accessibilityHint={
                  canShowBubbles ? t('counterWidget.expandIncrementsHint') : undefined
                }
              >
                <Text style={[styles.incrementLabel, { color: primaryFg }]}>
                  +{primaryIncrement}
                </Text>
              </Pressable>
            </ActionBubbleTray>

            {/* Only once there is a note; a first one is added from the history. */}
          {onDictateNote && hasTodayNote ? (
              <NoteIconButton
                hasNote
                onPress={onDictateNote}
                onLongPress={onEditNote}
                size={ACTION_ICON_SIZE - 4}
                style={cardStyles.iconButton}
              />
            ) : null}
          </View>
        </View>
      </TrackerCard>

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
                  style={[styles.sheetTitle, { color: theme.colors.onSurface }]}
                >
                  {t('counterWidget.editTotalTitle')}
                </Text>
                <IconButton
                  icon="close"
                  onPress={closeEdit}
                  disabled={saving}
                  accessibilityLabel={tCommon('actions.close')}
                />
              </View>

              <View style={styles.sheetBody}>
                <Text
                  variant="bodySmall"
                  style={[styles.sheetHint, { color: theme.colors.onSurfaceVariant }]}
                >
                  {t('counterWidget.replacesTotalHint', { unit: config.unit })}
                </Text>
                <TextInput
                  label={t('counterWidget.totalLabel', { unit: config.unit })}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="number-pad"
                  mode="outlined"
                  autoFocus
                  selectTextOnFocus
                />
              </View>

              <View style={styles.sheetFooter}>
                <Button onPress={closeEdit} disabled={saving}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void saveEdit()}
                  loading={saving}
                  disabled={saving}
                  buttonColor={isCartoon ? theme.colors.primary : undefined}
                  style={{ borderRadius: deco.buttonRadius }}
                >
                  {tCommon('actions.save')}
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
  countHit: {
    flexShrink: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  incrementHit: {
    minWidth: 52,
    minHeight: 48,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incrementLabel: {
    ...typeScale.data,
    fontSize: 18,
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
