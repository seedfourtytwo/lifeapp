import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { notify } from '../../components/sheet/confirm';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useHabitTimerControls } from '../../hooks/useHabitTimerControls';
import type { RootStackParamList } from '../../navigation/types';
import type { ElementDefinition, HabitConfig } from '../../protocol';
import { useEventStore } from '../../store/eventStore';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { TODO_MARK_TARGET } from '../todos/TodoRow';
import TodayMark, { type TodayMarkKind } from './TodayMark';

type RowProps = {
  mark: Exclude<TodayMarkKind, 'todoOpen'>;
  name: string;
  /** Takes it back: un-tick, un-skip, reopen. */
  onPressMark: () => void;
  markLabel: string;
  /** Opens what the row is about, where there is something to open. */
  onPressName?: () => void;
};

/**
 * A settled row under Done: its mark and its name, written on the page. It is
 * finished, so it carries no tile, no streak and no controls — only the mark,
 * which takes it back.
 */
export function DoneRow({ mark, name, onPressMark, markLabel, onPressName }: RowProps) {
  return (
    <Pressable
      onPress={onPressName}
      disabled={!onPressName}
      accessibilityRole={onPressName ? 'button' : undefined}
      accessibilityLabel={name}
      style={styles.row}
    >
      <Pressable
        onPress={onPressMark}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityLabel={markLabel}
        style={styles.mark}
      >
        <TodayMark kind={mark} />
      </Pressable>
      <QuietText numberOfLines={1} style={[typeScale.body, styles.name]}>
        {name}
      </QuietText>
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
    if (config.trackingMode === 'timer') {
      handleResetToday(habit.id, config)
        .then((undo) => onOfferUndo(t('undo.timerReset', { name: habit.name }), undo))
        .catch(report(t('habitWidget.couldNotResetTodayTitle')));
      return;
    }
    toggleHabit(habit.id, config).catch(report(t('habitWidget.couldNotUpdateTitle')));
  };

  return (
    <DoneRow
      mark={done ? 'habitDone' : 'habitSkipped'}
      name={habit.name}
      onPressMark={takeBack}
      markLabel={`${habit.name}, ${
        done ? t('habitWidget.completedTapToUndoA11y') : t('skip.undoSkipA11y')
      }`}
      onPressName={() => navigation.navigate('TrackerHistory', { elementId: habit.id })}
    />
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: space.sm,
    paddingRight: space.md,
    marginBottom: space.xs,
  },
  // No text in it, so the target is a fixed box.
  mark: {
    width: TODO_MARK_TARGET,
    height: TODO_MARK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});
