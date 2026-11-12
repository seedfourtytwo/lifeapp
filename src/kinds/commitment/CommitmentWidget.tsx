import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { nextLamp, type CommitmentElement } from '../../protocol';
import type { UrgeRide } from '../../store/urgeStore';
import { formatLampLabel, formatRideLeft, formatTimeClear } from '../../utils/commitmentFormat';
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
  onUrge: () => void;
  /** Back to the ride's own screen. */
  onOpenRide: () => void;
  onLogSlip: () => void;
  onOpenDetails: () => void;
};

/**
 * The commitment on Habits: time clear as a short clock, the next lamp and
 * the urges ridden out, and the Urge button. During a ride, in its place,
 * the ride's time left, which opens the ride's screen.
 */
export function CommitmentWidget({
  element,
  now,
  riddenOutTotal,
  ride,
  onUrge,
  onOpenRide,
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
          {riding ? (
            <Button
              mode="contained-tonal"
              compact
              icon="road-variant"
              onPress={onOpenRide}
              accessibilityLabel={t('commitment.openRideA11y', { time: formatRideLeft(rideLeftSeconds) })}
            >
              {formatRideLeft(rideLeftSeconds)}
            </Button>
          ) : (
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
    </TrackerCard>
  );
}

const local = StyleSheet.create({
  menuButton: {
    margin: 0,
  },
});
