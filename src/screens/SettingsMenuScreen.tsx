import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

export default function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Item
          title="Trackers"
          description="Manage, archive, and restore habits and counters"
          left={(props) => <List.Icon {...props} icon="shape-plus" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Trackers')}
        />
        <List.Item
          title="Insights"
          description="Compare habits, counters, and weather"
          left={(props) => <List.Icon {...props} icon="chart-timeline-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Insights')}
        />
        <List.Item
          title="Calendar"
          description="Birthdays, appointments, and reminders"
          left={(props) => <List.Icon {...props} icon="calendar-month" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Calendar')}
        />
        <List.Item
          title="App settings"
          description="About and preferences"
          left={(props) => <List.Icon {...props} icon="tune" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('AppSettings')}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    flexGrow: 1,
  },
});
