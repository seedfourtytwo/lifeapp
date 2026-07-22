import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/types';

export default function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('settings');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Item
          title={t('menu.insightsTitle')}
          description={t('menu.insightsDescription')}
          left={(props) => <List.Icon {...props} icon="chart-timeline-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Insights')}
        />
        <List.Item
          title={t('menu.journalTitle')}
          description={t('menu.journalDescription')}
          left={(props) => <List.Icon {...props} icon="notebook-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Journal')}
        />
        <List.Item
          title={t('menu.calendarTitle')}
          description={t('menu.calendarDescription')}
          left={(props) => <List.Icon {...props} icon="calendar-month" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Calendar')}
        />
      </List.Section>

      <List.Section title={t('menu.settingsSectionTitle')}>
        <List.Item
          title={t('menu.trackersTitle')}
          description={t('menu.trackersDescription')}
          left={(props) => <List.Icon {...props} icon="shape-plus" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Trackers')}
        />
        <List.Item
          title={t('menu.appSettingsTitle')}
          description={t('menu.appSettingsDescription')}
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
