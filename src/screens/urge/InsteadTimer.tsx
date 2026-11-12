import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  activeTimerElapsedSeconds,
  formatHabitTimerDuration,
  habitTimerGoal,
  isActiveTimerPaused,
  type ActiveTimerSession,
  type HabitElement,
} from '../../protocol';
import { space } from '../../theme/spacing';
import { GlassSurface } from '../../ui/GlassSurface';
import { NightText } from '../../ui/NightText';
import { RoundButton } from '../../ui/RoundButton';

type Props = {
  habit: HabitElement;
  session: ActiveTimerSession;
  /** Seconds already logged today, before this session. */
  loggedSeconds: number;
  nowMs: number;
  onPauseOrResume: () => void;
  onDone: () => void;
};

/**
 * The instead-habit running during a ride: its name, this session's time,
 * what is left of today's goal (as the widget shows it), pause and done.
 */
export function InsteadTimer({ habit, session, loggedSeconds, nowMs, onPauseOrResume, onDone }: Props) {
  const { t } = useTranslation('trackers');
  const paused = isActiveTimerPaused(session);
  const elapsed = formatHabitTimerDuration(activeTimerElapsedSeconds(session, nowMs));
  const goal = habitTimerGoal(habit.config);
  const goalLeft = goal.type === 'seconds' ? goal.seconds - Math.floor(loggedSeconds) : 0;

  return (
    <GlassSurface style={styles.surface}>
      <NightText kind="name">{habit.name}</NightText>
      <NightText kind="numberSmall" accessibilityRole="timer">
        {elapsed}
      </NightText>
      {goalLeft > 0 ? (
        <NightText kind="label" tone="dim">
          {t('urge.timerOf', { time: formatHabitTimerDuration(goalLeft) })}
        </NightText>
      ) : null}
      <View style={styles.controls}>
        <RoundButton
          icon={paused ? 'play' : 'pause'}
          light="teal"
          onPress={onPauseOrResume}
          accessibilityLabel={t(paused ? 'habitWidget.resumeTimerA11y' : 'habitWidget.pauseTimerA11y')}
        />
        <RoundButton icon="check" onPress={onDone} accessibilityLabel={t('habitWidget.finishSessionA11y')} />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: 'center',
    gap: space.xs,
  },
  controls: {
    flexDirection: 'row',
    gap: space.xl,
    marginTop: space.md,
  },
});
