import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { markHabitTimerDone, pressHabitTimer } from '../habitTimer/habitTimerControls';
import { refreshFromDb } from '../hooks/refreshFromDb';
import type { RootStackParamList } from '../navigation/types';
import {
  currentOwnLine,
  formatHabitTimerDuration,
  habitTimerGoal,
  usableInsteadHabits,
  type HabitElement,
} from '../protocol';
import { URGE_NOTE_MAX_LENGTH } from '../protocol/urge';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { todayDate } from '../store/events/state';
import { useUrgeStore } from '../store/urgeStore';
import { useVoiceNoteStore } from '../store/voiceNoteStore';
import { GlassSurface } from '../ui/GlassSurface';
import { NightBackground } from '../ui/NightBackground';
import { Field } from '../ui/Field';
import { useUndoBar } from '../ui/KitHost';
import { NightText } from '../ui/NightText';
import { PillButton } from '../ui/PillButton';
import { Road } from '../ui/Road';
import { RIDE_LAMP_AT, rideCarAt, rideProgress } from '../ui/roadScene';
import { RoundButton } from '../ui/RoundButton';
import { space } from '../ui/tokens';
import { formatRideLeft } from '../utils/commitmentFormat';
import { getActiveCommitment } from '../utils/dashboardElements';
import { InsteadTimer } from './urge/InsteadTimer';

type Props = NativeStackScreenProps<RootStackParamList, 'Urge'>;

/**
 * The ten minutes after an urge. The countdown to the lamp and the road,
 * his own line, one button per habit he chose to do instead, and a small
 * "I used". Leaving never ends the ride; the ride ends at the lamp, or when
 * the habit started from here ends, whichever is later. No debate, no
 * options, no colour of failure.
 */
export default function UrgeScreen({ navigation }: Props) {
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const storeRide = useUrgeStore((s) => s.ride);
  const riddenOutTotal = useUrgeStore((s) => s.riddenOutTotal);
  const elements = useElementStore((s) => s.elements);
  const sessions = useEventStore((s) => s.activeTimerSessions);
  const dailyTotals = useEventStore((s) => s.dailyTotals);
  const dayMapsDate = useEventStore((s) => s.dayMapsDate);
  const noteExists = useVoiceNoteStore((s) => s.exists);
  const notePlaying = useVoiceNoteStore((s) => s.playing);
  // The ride this screen carries: the one running when it opened.
  const [ride] = useState(storeRide);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [riddenOut, setRiddenOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const closed = useRef(false);

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const { show: showBar } = useUndoBar();
  const fail = useCallback(
    (error: unknown) => {
      console.warn('Urge screen write failed', error);
      showBar({ message: tCommon('alerts.couldNotSave') });
    },
    [tCommon, showBar],
  );

  useEffect(() => {
    if (!ride) close();
  }, [ride, close]);

  useEffect(() => {
    void useVoiceNoteStore.getState().refresh();
  }, []);

  const open = ride !== null && storeRide?.urgeId === ride.urgeId;

  // The urge left the open ones: ridden out, so say so; or settled elsewhere
  // (the widget's "I used", a wipe), so there is nothing left to carry.
  useEffect(() => {
    if (!ride || open || noting || riddenOut) return;
    let cancelled = false;
    useUrgeStore
      .getState()
      .readOutcome(ride.urgeId)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome === 'rode_out') setRiddenOut(true);
        else close();
      })
      .catch((error: unknown) => console.warn('Could not read how the urge ended', error));
    return () => {
      cancelled = true;
    };
  }, [ride, open, noting, riddenOut, close]);

  useEffect(() => {
    if (noting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [noting]);

  // At the lamp, the same catch-up as any return to the app counts the ride.
  useEffect(() => {
    if (!ride || !open) return;
    const timer = setTimeout(
      () => void refreshFromDb().catch((error: unknown) => console.warn('Ride end not caught up', error)),
      Math.max(0, Date.parse(ride.endsAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [ride, open]);

  const commitment = getActiveCommitment(elements);
  const insteadHabits = commitment ? usableInsteadHabits(commitment.config, elements) : [];
  const running = insteadHabits.find((habit) => sessions[habit.id]);
  const runningSession = running ? sessions[running.id] : undefined;
  const ownLine = commitment ? currentOwnLine(commitment.config, new Date(now)) : null;
  const leftSeconds = ride ? (Date.parse(ride.endsAt) - now) / 1000 : 0;
  const minutesLeft = Math.ceil(Math.max(0, leftSeconds) / 60);
  const progress = ride ? rideProgress(Date.parse(ride.startedAt), Date.parse(ride.endsAt), now) : 1;
  const over = riddenOut && !running;

  // Spoken once a minute, not every second.
  const spokenMinutes = useRef(minutesLeft);
  useEffect(() => {
    if (noting || over || minutesLeft === spokenMinutes.current) return;
    spokenMinutes.current = minutesLeft;
    if (minutesLeft > 0) AccessibilityInfo.announceForAccessibility(t('urge.minutesLeft', { count: minutesLeft }));
  }, [minutesLeft, noting, over, t]);

  useEffect(() => {
    if (over) {
      AccessibilityInfo.announceForAccessibility(
        `${t('urge.riddenOut')} ${t('urge.total', { count: riddenOutTotal })}`,
      );
    }
  }, [over, riddenOutTotal, t]);

  if (!ride) return null;

  const used = () => {
    setNoting(true);
    useUrgeStore.getState().resolveUrge(ride.urgeId, 'used').catch(fail);
  };

  const saveNote = () => {
    if (note.trim() === '') {
      close();
      return;
    }
    useUrgeStore.getState().noteUrge(ride.urgeId, note).catch(fail).finally(close);
  };

  const insteadLabel = (habit: HabitElement) => {
    const goal = habitTimerGoal(habit.config);
    return goal.type === 'seconds'
      ? t('urge.instead', { minutes: Math.round(goal.seconds / 60), name: habit.name })
      : habit.name;
  };

  const loggedToday = (habitId: string) => (dayMapsDate === todayDate() ? (dailyTotals[habitId] ?? 0) : 0);

  let body: React.ReactNode;
  if (noting) {
    body = (
      <View style={styles.noting}>
        <NightText kind="body">{t('urge.noteQuestion')}</NightText>
        <Field
          value={note}
          onChangeText={setNote}
          maxLength={URGE_NOTE_MAX_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveNote}
          accessibilityLabel={t('urge.noteQuestion')}
        />
        <View style={styles.row}>
          <View style={styles.grow}>
            <PillButton variant="quiet" label={t('urge.skip')} onPress={close} />
          </View>
          <View style={styles.grow}>
            <PillButton variant="primary" label={tCommon('actions.save')} onPress={saveNote} />
          </View>
        </View>
      </View>
    );
  } else if (over) {
    body = (
      <View style={styles.end}>
        <NightText kind="statement" style={styles.centred} accessibilityRole="header">
          {t('urge.riddenOut')}
        </NightText>
        <NightText kind="ownWords">{t('urge.total', { count: riddenOutTotal })}</NightText>
        <View style={styles.endButton}>
          <PillButton variant="primary" label={tCommon('actions.done')} onPress={close} />
        </View>
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.topBar}>
          <RoundButton icon="close" onPress={close} accessibilityLabel={t('urge.closeA11y')} />
        </View>
        <GlassSurface style={styles.ride}>
          <NightText kind="caption" tone="dim" style={styles.centred}>
            {t('urge.rideTitle')}
          </NightText>
          <NightText
            kind="number"
            style={styles.centred}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="timer"
            accessibilityLabel={t('commitment.rideLeftA11y', {
              time: formatHabitTimerDuration(Math.ceil(Math.max(0, leftSeconds))),
            })}
          >
            {formatRideLeft(leftSeconds)}
          </NightText>
          <Road
            carAt={rideCarAt(progress)}
            lampAt={RIDE_LAMP_AT}
            accessibilityLabel={t('urge.roadA11y', { percent: Math.round(progress * 100) })}
          />
        </GlassSurface>
        {ownLine ? (
          <NightText kind="ownWords" style={styles.ownLine}>
            {ownLine}
          </NightText>
        ) : null}
        {running && runningSession ? (
          <InsteadTimer
            habit={running}
            session={runningSession}
            loggedSeconds={loggedToday(running.id)}
            nowMs={now}
            onPauseOrResume={() => void pressHabitTimer(running.id)}
            onDone={() => void markHabitTimerDone(running.id, running.config).catch(fail)}
          />
        ) : (
          insteadHabits.map((habit) => (
            <PillButton
              key={habit.id}
              variant="primary"
              light="amber"
              label={insteadLabel(habit)}
              accessibilityLabel={t('commitment.startInsteadA11y', { name: habit.name })}
              onPress={() => void pressHabitTimer(habit.id)}
            />
          ))
        )}
        {noteExists ? (
          <PillButton
            variant="quiet"
            label={notePlaying ? t('urge.stopNote') : t('urge.playNote')}
            onPress={() =>
              void (notePlaying ? useVoiceNoteStore.getState().stop() : useVoiceNoteStore.getState().play())
            }
          />
        ) : null}
        <View style={styles.grow} />
        {open ? (
          <View style={styles.usedButton}>
            <PillButton
              variant="quiet"
              label={t('commitment.used')}
              accessibilityLabel={t('commitment.usedA11y')}
              onPress={used}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <NightBackground />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  topBar: {
    flexDirection: 'row',
  },
  ride: {
    gap: space.sm,
    paddingVertical: space.xl,
  },
  centred: {
    textAlign: 'center',
  },
  ownLine: {
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  grow: {
    flexGrow: 1,
    flexBasis: 0,
  },
  usedButton: {
    alignSelf: 'center',
  },
  noting: {
    gap: space.lg,
    paddingTop: space.xxl,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  end: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
  },
  endButton: {
    alignSelf: 'stretch',
    marginTop: space.xl,
  },
});
