import React from 'react';
import { List, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../store/settingsStore';

export default function CalendarSettingsSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('settings');
  const calendarWidgetEnabled = useSettingsStore((s) => s.calendarWidgetEnabled);
  const setCalendarWidgetEnabled = useSettingsStore((s) => s.setCalendarWidgetEnabled);

  return (
    <List.Section>
      <List.Subheader>{t('calendarSection.sectionTitle')}</List.Subheader>
      <List.Item
        title={t('calendarSection.widgetTitle')}
        description={t('calendarSection.widgetDescription')}
        left={(props) => <List.Icon {...props} icon="calendar" />}
        right={() => (
          <Switch
            value={calendarWidgetEnabled}
            onValueChange={(value) => void setCalendarWidgetEnabled(value)}
          />
        )}
      />
      <List.Item
        title={t('calendarSection.openTitle')}
        description={t('calendarSection.openDescription')}
        left={(props) => <List.Icon {...props} icon="calendar-month" />}
        onPress={() => navigation.navigate('Calendar')}
      />
    </List.Section>
  );
}
