import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { notify } from '../../components/sheet/confirm';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import type { RootStackParamList } from '../../navigation/types';
import { rowKindColour } from '../../kinds/rowKind';
import { ROW_TILE_SIZE, TrackerIdentityMark } from '../../kinds/TrackerIdentityMark';
import {
  formatHabitTimerDuration,
  type ElementDefinition,
  type HabitConfig,
  type TrackerIconId,
} from '../../protocol';
import { useEventStore } from '../../store/eventStore';
import type { KindColour } from '../../theme/palette';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import TodayMark, { type TodayMarkKind } from './TodayMark';

type RowProps = {
  mark: TodayMarkKind;
  /** Whose colour the row's small tile wears. */
  kind: KindColour;
  /** The tracker's own icon, where it has one. */
  icon?: TrackerIconId | null;
  name: string;
  /** What was logged — a timer's time. */
  figure?: string | null;
  /** Takes it back: un-tick, un-skip, reopen. */
  onPressMark: () => void;
  markLabel: string;
  /** Opens what the row is about, where there is something to open. */
  onPressName?: () => void;
};

/**
 * A settled row under Done, written on the page: its kind's tile made small,
 * its name gone quiet, and the done mark at the end. It is finished, so it
 * carries no card, no streak and no controls — only the mark, which takes it
 * back.
 */
export function DoneRow({
  mark,
  kind,
  icon = null,
  name,
  figure = null,
  onPressMark,
  markLabel,
  onPressName,
}: RowProps) {
  return (
    <Pressable
      onPress={onPressName}
      disabled={!onPressName}
      accessibilityRole={onPressName ? 'button' : undefined}
      accessibilityLabel={figure ? `${name}, ${figure}` : name}
      style={styles.row}
    >
      <View style={styles.tile}>
        <TrackerIdentityMark kind={kind} icon={icon} small />
      </View>
      <QuietText numberOfLines={1} style={[typeScale.body, styles.name]}>
        {name}
      </QuietText>
      {figure ? (
        <QuietText numberOfLines={1} style={typeScale.timer}>
          {figure}
        </QuietText>
      ) : null}
      <Pressable
        onPress={onPressMark}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityLabel={markLabel}
        style={styles.mark}
      >
        <TodayMark kind={mark} />
      </Pressable>
    </Pressable>
  );
}

type HabitProps = {
  habit: ElementDefinition;
  config: HabitConfig;
  /** Stable. Offers the way back from clearing a timer habit's day. */
  onOfferUndo: (message: string, undo: () => Promise<void>) => void;
};

/**
 * A done or skipped habit under Done. The mark undoes whichever it was: a tick
 * is taken back, a skip is lifted, and a timer habit's time today is cleared —
 * with Undo, since that one cannot be re-tapped back.
 */
export const DoneHabitRow = memo(function DoneHabitRow({ habit, config, onOfferUndo }: HabitProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { handleResetToday } = useHabitTimerControls();
  const done = useEventStore((s) => s.habitDoneToday[habit.id] ?? false);
  const total = useEventStore((s) => s.dailyTotals[habit.id] ?? 0);
  const timed = config.trackingMode === 'timer';
  const toggleHabit = useEventStore((s) => s.toggleHabit);
  const setSkipToday = useEventStore((s) => s.setSkipToday);

  const report = (title: string) => (error: unknown) => {
    notify({
      title,
      message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
    });
  };

  const takeBack = () => {
    if (!done) {
      setSkipToday(habit.id, { kind: 'habit', config }, false).catch(
        report(t('skip.couldNotSkipTitle')),
      );
      return;
    }
    if (timed) {
      handleResetToday(habit.id, config)
        .then((undo) => onOfferUndo(t('undo.timerReset', { name: habit.name }), undo))
        .catch(report(t('habitWidget.couldNotResetTodayTitle')));
      return;
    }
    toggleHabit(habit.id, config).catch(report(t('habitWidget.couldNotUpdateTitle')));
  };

  return (
    <DoneRow
      mark={done ? 'done' : 'skipped'}
      kind={rowKindColour({ kind: 'habit', trackingMode: config.trackingMode })}
      icon={config.icon}
      name={habit.name}
      figure={timed && total > 0 ? formatHabitTimerDuration(total) : null}
      onPressMark={takeBack}
      markLabel={`${habit.name}, ${
        done ? t('habitWidget.completedTapToUndoA11y') : t('skip.undoSkipA11y')
      }`}
      onPressName={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
});

/** The mark's touch target; the drawn disc sits in the middle of it. */
const MARK_TARGET = 48;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MARK_TARGET,
    gap: space.sm,
    // The same insets as a card's row, so tiles and marks stand in one line down the page.
    paddingLeft: space.md,
    paddingRight: space.sm,
  },
  /** The small tile, centred in the column a card's tile fills. */
  tile: {
    width: ROW_TILE_SIZE,
    alignItems: 'center',
    marginRight: space.xs,
  },
  // No text in it, so the target is a fixed box.
  mark: {
    width: MARK_TARGET,
    height: MARK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});
