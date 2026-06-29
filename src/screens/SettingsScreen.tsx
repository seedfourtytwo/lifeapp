import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { useSettingsStore } from '../store/settingsStore';
import { THEME_MODE_OPTIONS } from '../theme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

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
