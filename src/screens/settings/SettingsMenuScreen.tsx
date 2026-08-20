import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import SettingsGroup from '../../components/settings/SettingsGroup';
import SettingsRow from '../../components/settings/SettingsRow';
import type { RootStackParamList } from '../../navigation/types';

export default function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('settings');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsGroup>
        <SettingsRow
          icon="chart-timeline-variant"
          title={t('menu.insightsTitle')}
          chevron
          onPress={() => navigation.navigate('Insights')}
        />
        <SettingsRow
          icon="notebook-outline"
          title={t('menu.journalTitle')}
          chevron
          onPress={() => navigation.navigate('Journal')}
        />
        <SettingsRow
          icon="calendar-month"
          title={t('menu.calendarTitle')}
          chevron
          onPress={() => navigation.navigate('Calendar')}
        />
        <SettingsRow
          icon="checkbox-multiple-marked-outline"
          title={t('menu.trackersTitle')}
          chevron
          onPress={() => navigation.navigate('Trackers')}
        />
        <SettingsRow
          icon="food-apple-outline"
          title={t('menu.ingredientsTitle')}
          chevron
          onPress={() => navigation.navigate('Ingredients')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="cog-outline"
          title={t('menu.settingsTitle')}
          chevron
          onPress={() => navigation.navigate('AppSettings')}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
    paddingBottom: 32,
  },
});
