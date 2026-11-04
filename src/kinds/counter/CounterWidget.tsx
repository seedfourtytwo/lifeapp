import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { EditorSheet, FilledField } from '../../components/sheet';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { type CounterConfig } from '../../protocol';
import { playCounterTapHaptic } from '../../utils/habitHaptics';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as cardStyles } from '../trackerCardStyles';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { formatCounterStreakLabel } from './counterCardLabels';

const NOTE_ICON_SIZE = 24;

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
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [bubblesOpen, setBubblesOpen] = useState(false);

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? todayTotal / dailyTarget : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;
  const streakLabel = formatCounterStreakLabel(config, streak);

  const increments = config.quickIncrements;
  const primaryIncrement = increments[0];
  const extraIncrements = increments.slice(1);
  // Setting an exact total is a tap on the count, so the tray is only for +N.
  const canShowBubbles = extraIncrements.length > 0;

  const countText = hasTarget ? `${todayTotal} / ${dailyTarget}` : `${todayTotal}`;

  const metaColor = isComplete ? theme.colors.primary : theme.colors.onSurfaceVariant;

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
    void playCounterTapHaptic();
    onLog?.(increment, { source: 'quick_button', increment });
  };

  // A moss tint, not a solid slab: the +1 is the row's action, not its loudest thing.
  const primaryBg = theme.colors.primaryContainer;
  const primaryFg = theme.colors.primary;

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
      <TrackerCard>
        <View style={cardStyles.oneLineRow}>
          <TrackerCardTitle
            name={element.name}
            icon={config.icon}
            progress={hasTarget ? progress : null}
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

          <View style={cardStyles.trailingCluster}>
            <Pressable
              onPress={onSetDailyTotal ? openEdit : undefined}
              disabled={!onSetDailyTotal}
              hitSlop={space.sm}
              style={({ pressed }) => [styles.countHit, pressed && styles.pressed]}
              accessibilityRole={onSetDailyTotal ? 'button' : undefined}
              accessibilityLabel={countText}
              accessibilityHint={onSetDailyTotal ? t('counterWidget.tapCountToSetHint') : undefined}
            >
              <Text
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
                  { backgroundColor: primaryBg },
                  pressed && styles.pressed,
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
                size={NOTE_ICON_SIZE}
                style={cardStyles.iconButton}
              />
            ) : null}
          </View>
        </View>
      </TrackerCard>

      <EditorSheet
        visible={editVisible}
        onDismiss={closeEdit}
        dismissable={!saving}
        title={t('counterWidget.editTotalTitle')}
        primaryAction={{
          label: tCommon('actions.save'),
          onPress: () => void saveEdit(),
          loading: saving,
          disabled: saving,
        }}
      >
        <FilledField
          label={t('counterWidget.totalLabel', { unit: config.unit })}
          value={editValue}
          onChangeText={setEditValue}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          onSubmitEditing={() => void saveEdit()}
        />
        <Text style={[typeScale.caption, styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          {t('counterWidget.replacesTotalHint', { unit: config.unit })}
        </Text>
      </EditorSheet>
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
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: space.md,
    // Geometry: half the height makes it a pill.
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incrementLabel: {
    ...typeScale.data,
    fontSize: 17,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  hint: {
    marginTop: space.sm,
  },
});
