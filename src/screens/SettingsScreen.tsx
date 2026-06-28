import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Switch, Text } from 'react-native-paper';
import { useSettingsStore } from '../store/settingsStore';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Dark mode"
          description="Easier on the eyes at night"
          left={(props) => <List.Icon {...props} icon="weather-night" />}
          right={() => (
            <Switch
              value={darkMode}
              onValueChange={(value) => void setDarkMode(value)}
            />
          )}
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
  note: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  noteText: {
    opacity: 0.6,
    lineHeight: 20,
  },
});
