import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
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
