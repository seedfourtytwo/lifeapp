import React, { useCallback, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, List, Switch, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { requestNotificationPermissions, isNotificationsNativeAvailable } from '../notifications/habitReminders';
import { useSettingsStore } from '../store/settingsStore';
import { useSoundLibraryStore } from '../store/soundLibraryStore';
import { THEME_MODE_OPTIONS } from '../theme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const setHabitRemindersEnabled = useSettingsStore((s) => s.setHabitRemindersEnabled);
  const sounds = useSoundLibraryStore((s) => s.sounds);
  const loadSounds = useSoundLibraryStore((s) => s.load);
  const addFromFile = useSoundLibraryStore((s) => s.addFromFile);
  const removeSound = useSoundLibraryStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      void loadSounds();
    }, [loadSounds]),
  );

  useEffect(() => {
    void loadSounds();
  }, [loadSounds]);

  const confirmRemove = (id: string, label: string) => {
    Alert.alert('Remove sound track?', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeSound(id),
      },
    ]);
  };

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
    <ScrollView contentContainerStyle={styles.container}>
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
        <List.Subheader>Sound tracks</List.Subheader>
        <Text variant="bodySmall" style={styles.sectionNote}>
          Add audio files for timer habits (e.g. meditation). Tracks stay on this device.
        </Text>
        {sounds.length === 0 ? (
          <Text variant="bodyMedium" style={styles.emptySounds}>
            No tracks yet.
          </Text>
        ) : (
          sounds.map((sound) => (
            <List.Item
              key={sound.id}
              title={sound.label}
              description={sound.source === 'file' ? 'Local file' : sound.source}
              left={(props) => <List.Icon {...props} icon="music-note" />}
              right={() => (
                <IconButton
                  icon="delete-outline"
                  onPress={() => confirmRemove(sound.id, sound.label)}
                  accessibilityLabel={`Remove ${sound.label}`}
                />
              )}
            />
          ))
        )}
        <View style={styles.addSoundRow}>
          <Button mode="outlined" icon="file-music-outline" onPress={() => void addFromFile()}>
            Add from files
          </Button>
        </View>
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
          Your data stays on this device. Export and backup options are coming soon.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  sectionNote: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    opacity: 0.6,
    lineHeight: 20,
  },
  emptySounds: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    opacity: 0.6,
  },
  addSoundRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
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
