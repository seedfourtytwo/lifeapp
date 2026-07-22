import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, List, Switch, Text, useTheme } from 'react-native-paper';
import ClearDataSheet from '../components/ClearDataSheet';
import WeatherSettingsSection from '../components/WeatherSettingsSection';
import CalendarSettingsSection from '../components/CalendarSettingsSection';
import { useProtocolBackup } from '../hooks/useProtocolBackup';
import {
  requestNotificationPermissions,
  isNotificationsNativeAvailable,
} from '../notifications/habitReminders';
import { useSettingsStore } from '../store/settingsStore';
import { THEME_MODE_OPTIONS } from '../theme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const setHabitRemindersEnabled = useSettingsStore((s) => s.setHabitRemindersEnabled);
  const {
    busy,
    importAvailable,
    clearSheetVisible,
    handleExport,
    handleImport,
    openClearSheet,
    dismissClearSheet,
    handleClearConfirm,
  } = useProtocolBackup();

  const handleRemindersToggle = async (enabled: boolean) => {
    if (enabled && !isNotificationsNativeAvailable()) {
      Alert.alert(
        'Rebuild required',
        'Habit reminders need a fresh dev build. Run: npx expo run:android',
      );
      return;
    }
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications in system settings to get habit reminders.',
        );
        return;
      }
    }
    await setHabitRemindersEnabled(enabled);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        {THEME_MODE_OPTIONS.map((option) => (
          <List.Item
            key={option.value}
            title={option.label}
            description={option.description}
            left={(props) => <List.Icon {...props} icon={option.icon} />}
            onPress={() => void setThemeMode(option.value)}
            right={() =>
              themeMode === option.value ? (
                <List.Icon icon="check-circle" color={theme.colors.primary} />
              ) : null
            }
          />
        ))}
      </List.Section>

      <WeatherSettingsSection />

      <CalendarSettingsSection />

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Habit reminders"
          description="Remind before scheduled habits and at 8 PM if habits remain"
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={() => (
            <Switch
              value={habitRemindersEnabled}
              onValueChange={(value) => void handleRemindersToggle(value)}
            />
          )}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Data</List.Subheader>
        <List.Item
          title="Export backup"
          description="Save habits, counters, calendar, notes, journals, history, and preferences as JSON"
          left={(props) => <List.Icon {...props} icon="export" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : () => void handleExport()}
        />
        <List.Item
          title="Import backup"
          description={
            importAvailable
              ? 'Replace this device with a backup file'
              : 'Needs dev client rebuild — export works now'
          }
          left={(props) => <List.Icon {...props} icon="import" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : handleImport}
        />
        <List.Item
          title="Clear data…"
          description="Wipe history, calendar, cache, prefs — or habits/counters"
          left={(props) => <List.Icon {...props} icon="delete-forever" color={theme.colors.error} />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : openClearSheet}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Life Dashboard"
          description={`Version ${APP_VERSION}`}
          left={(props) => <List.Icon {...props} icon="information-outline" />}
        />
      </List.Section>

      <View style={styles.note}>
        <Text variant="bodySmall" style={styles.noteText}>
          Backups are JSON files you can move between installs. Import replaces all local data
          (including tracker notes and journals). Clear data can keep habits and counters while
          wiping activity only.
        </Text>
      </View>

      <ClearDataSheet
        visible={clearSheetVisible}
        busy={busy}
        onDismiss={dismissClearSheet}
        onConfirm={handleClearConfirm}
        onExportFirst={() => void handleExport()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  note: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  noteText: {
    opacity: 0.6,
    lineHeight: 20,
  },
});
