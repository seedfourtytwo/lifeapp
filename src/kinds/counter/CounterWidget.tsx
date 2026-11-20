import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { EditorSheet, FilledField } from '../../components/sheet';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { type CounterConfig } from '../../protocol';
import { playCounterTapHaptic } from '../../utils/habitHaptics';
import { ActionBubbleTray } from '../../components/ActionBubbleTray';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as cardStyles } from '../trackerCardStyles';
import { TrackerCardFigure } from '../TrackerCardFigure';
import { TrackerCardTitle } from '../TrackerCardTitle';
import { trackerCardTitleInteractions } from '../trackerCardTitleInteractions';
import { counterCardCaption } from './counterCardLabels';
import { skipTodayBubbles } from '../skipTodayBubble';
import { rowKindColour } from '../rowKind';
import { notify } from '../../components/sheet/confirm';

const NOTE_ICON_SIZE = 24;
/** The steps drawn in the row's capsule, as on the widget; any more wait in the tray. */
const CAPSULE_STEPS = 2;

export function CounterWidget({
  element,
  config,
  todayTotal,
  streak,
  score,
  skipped,
  onSkipToday,
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
  const { decorations: deco, palette } = useAppTheme();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [bubblesOpen, setBubblesOpen] = useState(false);

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;
  const caption = counterCardCaption(config, { streak, score, skipped: skipped && !isComplete });

  const capsuleIncrements = config.quickIncrements.slice(0, CAPSULE_STEPS);
  const extraIncrements = config.quickIncrements.slice(CAPSULE_STEPS);

  const countText = hasTarget ? `${todayTotal} / ${dailyTarget}` : `${todayTotal}`;

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
      void notify({
        title: t('counterWidget.invalidTotalTitle'),
        message: t('counterWidget.invalidTotalBody'),
      });
      return;
    }
    setSaving(true);
    try {
      await onSetDailyTotal?.(total);
      setEditVisible(false);
    } catch (error) {
      void notify({
        title: t('counterWidget.couldNotUpdateTitle'),
        message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      });
    } finally {
      setSaving(false);
    }
  };

  const logIncrement = (increment: number) => {
    setBubblesOpen(false);
    void playCounterTapHaptic();
    onLog?.(increment, { source: 'quick_button', increment });
  };

  const paint = palette.kind[rowKindColour({ kind: 'counter' })];

  // Setting an exact total is a tap on the count, so the tray holds the steps
  // past the capsule's two and, with a daily target, Skip today.
  const bubbles = [
    ...extraIncrements.map((increment) => ({
      key: `inc-${increment}`,
      label: `+${increment}`,
      accessibilityLabel: t('counterWidget.addIncrementA11y', { count: increment }),
      onPress: () => logIncrement(increment),
    })),
    ...(hasTarget
      ? skipTodayBubbles({ complete: isComplete, skipped: Boolean(skipped), onSkipToday })
      : []),
  ];
  const canShowBubbles = bubbles.length > 0;

  return (
    <>
      <TrackerCard>
        <View style={cardStyles.oneLineRow}>
          <TrackerCardTitle
            name={element.name}
            kind={rowKindColour({ kind: 'counter' })}
            icon={config.icon}
            caption={caption}
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
              <TrackerCardFigure figure={countText} />
            </Pressable>

            <ActionBubbleTray
              open={bubblesOpen}
              onDismiss={() => setBubblesOpen(false)}
              bubbles={bubbles}
            >
              <View
                style={[
                  styles.capsule,
                  { backgroundColor: paint.wash, borderRadius: deco.radius.pill },
                ]}
              >
                {capsuleIncrements.map((increment, index) => (
                  <React.Fragment key={`${index}-${increment}`}>
                    {index > 0 ? (
                      <View
                        style={[
                          styles.rule,
                          { width: deco.borderWidth, backgroundColor: paint.ink },
                        ]}
                      />
                    ) : null}
                    <Pressable
                      onPress={() => logIncrement(increment)}
                      onLongPress={
                        canShowBubbles ? () => setBubblesOpen((open) => !open) : undefined
                      }
                      delayLongPress={350}
                      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t('counterWidget.addIncrementA11y', { count: increment })}
                      accessibilityHint={
                        extraIncrements.length > 0
                          ? t('counterWidget.expandIncrementsHint')
                          : canShowBubbles
                            ? t('skip.longPressHint')
                            : undefined
                      }
                    >
                      <Text style={[typeScale.timer, { color: paint.ink }]}>+{increment}</Text>
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
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
  /** Both steps in one pill: two targets, one shape. */
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The short rule between the two steps. */
  rule: {
    height: 20,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  hint: {
    marginTop: space.sm,
  },
});
