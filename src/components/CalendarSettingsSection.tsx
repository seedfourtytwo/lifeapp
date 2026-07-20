import React from 'react';
import { List, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../store/settingsStore';

export default function CalendarSettingsSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const calendarWidgetEnabled = useSettingsStore((s) => s.calendarWidgetEnabled);
  const setCalendarWidgetEnabled = useSettingsStore((s) => s.setCalendarWidgetEnabled);

  return (
    <List.Section>
      <List.Subheader>Calendar</List.Subheader>
      <List.Item
        title="Home calendar bubble"
        description="Show today’s date on Home and peek at upcoming events"
        left={(props) => <List.Icon {...props} icon="calendar" />}
        right={() => (
          <Switch
            value={calendarWidgetEnabled}
            onValueChange={(value) => void setCalendarWidgetEnabled(value)}
          />
        )}
      />
      <List.Item
        title="Open calendar"
        description="Browse month view, add birthdays and appointments"
        left={(props) => <List.Icon {...props} icon="calendar-month" />}
        onPress={() => navigation.navigate('Calendar')}
      />
    </List.Section>
  );
}
