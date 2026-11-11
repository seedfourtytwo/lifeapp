import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import {
  formatHabitTimerDuration,
  nextLamp,
  type CommitmentElement,
  type HabitElement,
} from '../../protocol';
import type { UrgeRide } from '../../store/urgeStore';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatLampLabel, formatTimeClear } from '../../utils/commitmentFormat';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import { TrackerCardTitle } from '../TrackerCardTitle';

export type CommitmentWidgetProps = {
  element: CommitmentElement;
  /** The moment shown; the caller ticks it. */
  now: Date;
  riddenOutTotal: number;
  /** The open urge's ride, or null. */
  ride: UrgeRide | null;
  /** Instead-habits that can be started now, in the order chosen. */
  insteadHabits: readonly HabitElement[];
  onUrge: () => void;
  onStartInstead: (habitId: string) => void;
  onUsed: (urgeId: string) => void;
  onLogSlip: () => void;
  onOpenDetails: () => void;
};

/**
 * The commitment on Habits: time clear as a short clock, the next lamp and
 * the urges ridden out, and the Urge button. During a ride: its countdown,
 * the habits to start instead, and a small quiet "I used".
 */
export function CommitmentWidget({
  element,
  now,
  riddenOutTotal,
  ride,
  insteadHabits,
  onUrge,
  onStartInstead,
  onUsed,
  onLogSlip,
  onOpenDetails,
}: CommitmentWidgetProps) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [menuOpen, setMenuOpen] = useState(false);
  const { config } = element;
  const timeClear = formatTimeClear(now.getTime() - Date.parse(config.clearSince));
  const caption = [
    t('commitment.nextLamp', { lamp: formatLampLabel(nextLamp(config.clearSince, now).hours) }),
    t('commitment.riddenOut', { count: riddenOutTotal }),
  ].join(' · ');
  const rideLeftSeconds = ride ? Math.ceil((Date.parse(ride.endsAt) - now.getTime()) / 1000) : 0;
  const riding = ride !== null && rideLeftSeconds > 0;

  return (
    <TrackerCard>
      <View style={styles.oneLineRow}>
        <TrackerCardTitle name={element.name} streakLabel={caption} onOpenDetails={onOpenDetails} />
        <View style={styles.trailingCluster}>
          <Text
            numberOfLines={1}
            style={[styles.timerLabel, { color: theme.colors.onSurface }]}
            accessibilityLabel={t('commitment.timeClearA11y', { time: timeClear })}
          >
            {timeClear}
          </Text>
          {riding ? null : (
            <Button
              mode="contained-tonal"
              compact
              onPress={onUrge}
              accessibilityLabel={t('commitment.urgeA11y')}
            >
              {t('commitment.urge')}
            </Button>
          )}
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => setMenuOpen(true)}
                accessibilityLabel={t('commitment.menuA11y', { name: element.name })}
                style={local.menuButton}
              />
            }
          >
            <Menu.Item
              title={t('commitment.logSlip')}
              onPress={() => {
                setMenuOpen(false);
                onLogSlip();
              }}
            />
          </Menu>
        </View>
      </View>

      {riding && ride ? (
        <View style={local.rideRow}>
          <View style={local.rideClock}>
            <QuietText style={typeScale.caption}>{t('commitment.rideCaption')}</QuietText>
            <Text
              style={[styles.timerLabel, { color: theme.colors.onSurface }]}
              accessibilityLabel={t('commitment.rideLeftA11y', {
                time: formatHabitTimerDuration(rideLeftSeconds),
              })}
            >
              {formatHabitTimerDuration(rideLeftSeconds)}
            </Text>
          </View>
          <View style={local.rideActions}>
            {insteadHabits.map((habit) => (
              <Button
                key={habit.id}
                mode="contained-tonal"
                compact
                icon="play"
                onPress={() => onStartInstead(habit.id)}
                accessibilityLabel={t('commitment.startInsteadA11y', { name: habit.name })}
              >
                {habit.name}
              </Button>
            ))}
            <Button
              mode="text"
              compact
              textColor={theme.colors.onSurfaceVariant}
              onPress={() => onUsed(ride.urgeId)}
              accessibilityLabel={t('commitment.usedA11y')}
            >
              {t('commitment.used')}
            </Button>
          </View>
        </View>
      ) : null}
    </TrackerCard>
  );
}

const local = StyleSheet.create({
  menuButton: {
    margin: 0,
  },
  rideRow: {
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingBottom: space.md,
  },
  rideClock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingRight: space.sm,
  },
  rideActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
});
