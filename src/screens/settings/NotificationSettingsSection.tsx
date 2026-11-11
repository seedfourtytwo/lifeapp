import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { SettingsGroup, SettingsRow } from '../../components/settings';
import { FilledField } from '../../components/sheet';
import { parseEveningCheckInTime } from '../../protocol/appSettings';
import { useNotificationPermissionStore } from '../../store/notificationPermissionStore';
import { useSettingsStore } from '../../store/settingsStore';

const TIME_FIELD_WIDTH = 96;

/** Evening check-in, the habit reminder switch, and a way back when notifications are blocked. */
export default function NotificationSettingsSection() {
  const { t } = useTranslation('settings');
  const eveningEnabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const eveningTime = useSettingsStore((s) => s.eveningCheckInTime);
  const setEveningEnabled = useSettingsStore((s) => s.setEveningCheckInEnabled);
  const setEveningTime = useSettingsStore((s) => s.setEveningCheckInTime);
  const trackerReminders = useSettingsStore((s) => s.trackerRemindersEnabled);
  const setTrackerReminders = useSettingsStore((s) => s.setTrackerRemindersEnabled);
  const permission = useNotificationPermissionStore((s) => s.permission);
  const refreshPermission = useNotificationPermissionStore((s) => s.refresh);
  const requestPermission = useNotificationPermissionStore((s) => s.request);
  const [timeDraft, setTimeDraft] = useState(eveningTime);

  useEffect(() => setTimeDraft(eveningTime), [eveningTime]);

  // Coming back from system settings is the usual way a denial changes.
  useEffect(() => {
    void refreshPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const commitTime = () => {
    const parsed = parseEveningCheckInTime(timeDraft);
    if (!parsed) {
      setTimeDraft(eveningTime);
      return;
    }
    setTimeDraft(parsed);
    if (parsed !== eveningTime) void setEveningTime(parsed);
  };

  return (
    <SettingsGroup title={t('notifications.sectionTitle')}>
      {permission?.status === 'denied' ? (
        <SettingsRow
          icon="bell-off-outline"
          title={t('notifications.deniedTitle')}
          description={t('notifications.deniedBody')}
          trailing={
            <Button
              mode="text"
              compact
              onPress={() => void requestPermission()}
              accessibilityLabel={t('notifications.allowA11y')}
            >
              {t('notifications.allow')}
            </Button>
          }
        />
      ) : null}
      <SettingsRow
        icon="weather-night"
        title={t('notifications.eveningTitle')}
        description={t('notifications.eveningDescription')}
        switchValue={eveningEnabled}
        onSwitch={(value) => void setEveningEnabled(value)}
      />
      {eveningEnabled ? (
        <SettingsRow
          icon="clock-outline"
          title={t('notifications.eveningTimeTitle')}
          trailing={
            <FilledField
              value={timeDraft}
              onChangeText={setTimeDraft}
              onEndEditing={commitTime}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={t('notifications.eveningTimeA11y')}
              style={styles.timeField}
            />
          }
        />
      ) : null}
      <SettingsRow
        icon="bell-ring-outline"
        title={t('notifications.habitRemindersTitle')}
        description={t('notifications.habitRemindersDescription')}
        switchValue={trackerReminders}
        onSwitch={(value) => void setTrackerReminders(value)}
      />
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  timeField: {
    width: TIME_FIELD_WIDTH,
  },
});
