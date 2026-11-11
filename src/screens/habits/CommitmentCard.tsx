import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { pressHabitTimer } from '../../habitTimer/habitTimerControls';
import { refreshFromDb } from '../../hooks/refreshFromDb';
import { CommitmentWidget } from '../../kinds/commitment/CommitmentWidget';
import type { RootStackParamList } from '../../navigation/types';
import { usableInsteadHabits, type CommitmentElement } from '../../protocol';
import { useElementStore } from '../../store/elementStore';
import { useEventStore } from '../../store/eventStore';
import { useUrgeStore } from '../../store/urgeStore';

/** While a ride counts down the card ticks each second; otherwise each half minute is enough. */
const RIDE_TICK_MS = 1000;
const CLOCK_TICK_MS = 30_000;

export default function CommitmentCard({ commitment }: { commitment: CommitmentElement }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const elements = useElementStore((s) => s.elements);
  const logSlip = useElementStore((s) => s.logSlip);
  const sessions = useEventStore((s) => s.activeTimerSessions);
  const ride = useUrgeStore((s) => s.ride);
  const riddenOutTotal = useUrgeStore((s) => s.riddenOutTotal);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ride ? RIDE_TICK_MS : CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [ride]);

  // At the ride's end the app runs the same catch-up as on any return, which
  // counts the urge ridden out (after applying a "used" the widget queued).
  useEffect(() => {
    if (!ride) return;
    const timer = setTimeout(
      () => void refreshFromDb(),
      Math.max(0, Date.parse(ride.endsAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [ride]);

  // A habit already running is left out: pressing it again would pause it.
  const insteadHabits = useMemo(
    () =>
      usableInsteadHabits(commitment.config, elements).filter((habit) => {
        const session = sessions[habit.id];
        return !session || session.pausedAt !== null;
      }),
    [commitment.config, elements, sessions],
  );

  const fail = (error: unknown) => {
    Alert.alert(
      tCommon('alerts.couldNotSave'),
      error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
    );
  };

  const confirmSlip = () => {
    Alert.alert(t('commitment.slipConfirmTitle'), t('commitment.slipConfirmBody'), [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      { text: t('commitment.slipConfirm'), onPress: () => void logSlip(commitment.id).catch(fail) },
    ]);
  };

  return (
    <CommitmentWidget
      element={commitment}
      now={now}
      riddenOutTotal={riddenOutTotal}
      ride={ride}
      insteadHabits={insteadHabits}
      onUrge={() => {
        setNow(new Date());
        void useUrgeStore.getState().logUrge().catch(fail);
      }}
      onStartInstead={(habitId) => void pressHabitTimer(habitId)}
      onUsed={(urgeId) => void useUrgeStore.getState().resolveUrge(urgeId, 'used').catch(fail)}
      onLogSlip={confirmSlip}
      onOpenDetails={() => navigation.navigate('TrackerHistory', { elementId: commitment.id })}
    />
  );
}
