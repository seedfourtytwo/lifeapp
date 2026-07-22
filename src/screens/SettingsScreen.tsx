import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, List, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ClearDataSheet from '../components/ClearDataSheet';
import WeatherSettingsSection from '../components/WeatherSettingsSection';
import CalendarSettingsSection from '../components/CalendarSettingsSection';
import { useProtocolBackup } from '../hooks/useProtocolBackup';
import type { AppLanguage } from '../protocol/appSettings';
import { parseEveningCheckInTime } from '../protocol/appSettings';
import { applyAppLanguage } from '../i18n';
import {
  requestNotificationPermissions,
  isNotificationsNativeAvailable,
} from '../notifications/habitReminders';
import { useSettingsStore } from '../store/settingsStore';
import { APP_LANGUAGE_OPTIONS, THEME_MODE_OPTIONS } from '../theme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setAppLanguage = useSettingsStore((s) => s.setAppLanguage);
  const eveningCheckInEnabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const eveningCheckInTime = useSettingsStore((s) => s.eveningCheckInTime);
  const setEveningCheckInEnabled = useSettingsStore((s) => s.setEveningCheckInEnabled);
  const setEveningCheckInTime = useSettingsStore((s) => s.setEveningCheckInTime);
  const [timeDraft, setTimeDraft] = useState(eveningCheckInTime);
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

  useEffect(() => {
    setTimeDraft(eveningCheckInTime);
  }, [eveningCheckInTime]);

  const handleLanguageChange = async (language: AppLanguage) => {
    await setAppLanguage(language);
    await applyAppLanguage(language);
  };

  const handleEveningCheckInToggle = async (enabled: boolean) => {
    if (enabled && !isNotificationsNativeAvailable()) {
      Alert.alert(
        t('appearance.rebuildRequiredTitle'),
        t('notifications.rebuildRequiredBody'),
      );
      return;
    }
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(t('notifications.blockedTitle'), t('notifications.blockedBody'));
        return;
      }
    }
    await setEveningCheckInEnabled(enabled);
  };

  const commitEveningCheckInTime = () => {
    const parsed = parseEveningCheckInTime(timeDraft);
    if (!parsed) {
      setTimeDraft(eveningCheckInTime);
      Alert.alert(
        t('notifications.invalidTimeTitle'),
        t('notifications.invalidTimeBody'),
      );
      return;
    }
    if (parsed !== eveningCheckInTime) {
      void setEveningCheckInTime(parsed);
    } else {
      setTimeDraft(parsed);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <List.Section>
        <List.Subheader>{t('appearance.sectionTitle')}</List.Subheader>
        {THEME_MODE_OPTIONS.map((option) => (
          <List.Item
            key={option.value}
            title={t(option.labelKey)}
            description={t(option.descriptionKey)}
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
        <List.Subheader>{t('appearance.languageSectionTitle')}</List.Subheader>
        {APP_LANGUAGE_OPTIONS.map((option) => (
          <List.Item
            key={option.value}
            title={t(option.labelKey)}
            description={t(option.descriptionKey)}
            left={(props) => <List.Icon {...props} icon={option.icon} />}
            onPress={() => void handleLanguageChange(option.value)}
            right={() =>
              appLanguage === option.value ? (
                <List.Icon icon="check-circle" color={theme.colors.primary} />
              ) : null
            }
          />
        ))}
      </List.Section>

      <WeatherSettingsSection />

      <CalendarSettingsSection />

      <List.Section>
        <List.Subheader>{t('notifications.sectionTitle')}</List.Subheader>
        <List.Item
          title={t('notifications.eveningCheckInTitle')}
          description={t('notifications.eveningCheckInDescription')}
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={() => (
            <Switch
              value={eveningCheckInEnabled}
              onValueChange={(value) => void handleEveningCheckInToggle(value)}
            />
          )}
        />
        {eveningCheckInEnabled ? (
          <View style={styles.timeFieldWrap}>
            <TextInput
              label={t('notifications.eveningCheckInTimeLabel')}
              placeholder={t('notifications.eveningCheckInTimePlaceholder')}
              value={timeDraft}
              onChangeText={setTimeDraft}
              onBlur={commitEveningCheckInTime}
              onSubmitEditing={commitEveningCheckInTime}
              keyboardType="numbers-and-punctuation"
              mode="outlined"
              dense
            />
          </View>
        ) : null}
      </List.Section>

      <List.Section>
        <List.Subheader>{t('data.sectionTitle')}</List.Subheader>
        <List.Item
          title={t('data.exportTitle')}
          description={t('data.exportDescription')}
          left={(props) => <List.Icon {...props} icon="export" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : () => void handleExport()}
        />
        <List.Item
          title={t('data.importTitle')}
          description={
            importAvailable
              ? t('data.importDescriptionAvailable')
              : t('data.importDescriptionUnavailable')
          }
          left={(props) => <List.Icon {...props} icon="import" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : handleImport}
        />
        <List.Item
          title={t('data.clearDataTitle')}
          description={t('data.clearDataDescription')}
          left={(props) => <List.Icon {...props} icon="delete-forever" color={theme.colors.error} />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : openClearSheet}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>{t('about.sectionTitle')}</List.Subheader>
        <List.Item
          title={t('about.title')}
          description={t('about.version', { version: APP_VERSION })}
          left={(props) => <List.Icon {...props} icon="information-outline" />}
        />
      </List.Section>

      <View style={styles.note}>
        <Text variant="bodySmall" style={styles.noteText}>
          {t('about.note')}
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
  timeFieldWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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
