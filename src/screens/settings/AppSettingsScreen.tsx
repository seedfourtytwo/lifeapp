import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ClearDataSheet from '../../components/ClearDataSheet';
import ClearNotebookSheet from '../../components/ClearNotebookSheet';
import SettingsGroup from '../../components/settings/SettingsGroup';
import SettingsRow from '../../components/settings/SettingsRow';
import SettingsSegmented from '../../components/settings/SettingsSegmented';
import { useProtocolBackup } from '../../hooks/useProtocolBackup';
import type { AppLanguage } from '../../protocol/appSettings';
import type { JournalNotebook } from '../../protocol';
import { applyAppLanguage } from '../../i18n';
import { useJournalNotebookStore } from '../../store/journalNotebookStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWeatherStore } from '../../store/weatherStore';
import { APP_LANGUAGE_OPTIONS, THEME_MODE_OPTIONS, isThemeMode } from '../../theme';
import { clearJournalNotebookEntries } from '../../notes/journalNotebooks';
import { getAppVersion } from '../../utils/appVersion';
import type { SettingsStackParamList } from '../../navigation/types';

export default function AppSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setAppLanguage = useSettingsStore((s) => s.setAppLanguage);
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const setWeatherWidgetEnabled = useSettingsStore((s) => s.setWeatherWidgetEnabled);
  const weatherPlaceName = useSettingsStore((s) => s.weatherPlaceName);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const refreshWeather = useWeatherStore((s) => s.refresh);
  const clearWeather = useWeatherStore((s) => s.clear);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const notebooks = useJournalNotebookStore((s) => s.notebooks);
  const reloadNotebooks = useJournalNotebookStore((s) => s.reload);
  const [clearNotebookVisible, setClearNotebookVisible] = useState(false);
  const [clearNotebookBusy, setClearNotebookBusy] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      void reloadNotebooks();
    }, [reloadNotebooks]),
  );

  const languageLabel =
    APP_LANGUAGE_OPTIONS.find((option) => option.value === appLanguage)?.labelKey ??
    'appearance.languageSystem';

  const weatherSubtitle = weatherWidgetEnabled
    ? (weatherPlaceName ?? t('homeChrome.on'))
    : t('homeChrome.off');

  const locationValue =
    weatherLocationMode === 'device'
      ? t('weather.descriptionUsingGps')
      : weatherPlaceName ?? undefined;

  const handleClearNotebook = async (notebook: JournalNotebook) => {
    setClearNotebookBusy(true);
    try {
      await clearJournalNotebookEntries(notebook.id);
      setClearNotebookVisible(false);
      Alert.alert(
        t('data.clearNotebookDoneTitle'),
        t('data.clearNotebookDoneBody', { name: notebook.name }),
      );
    } catch {
      Alert.alert(t('data.clearNotebookFailedTitle'), t('data.clearFailedBodyFallback'));
    } finally {
      setClearNotebookBusy(false);
    }
  };

  const handleLanguageChange = async (language: AppLanguage) => {
    setLanguageMenuOpen(false);
    await setAppLanguage(language);
    await applyAppLanguage(language);
  };

  const handleWeatherToggle = async (enabled: boolean) => {
    await setWeatherWidgetEnabled(enabled);
    if (enabled) {
      void refreshWeather({ force: true });
    } else {
      clearWeather();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SettingsGroup title={t('appearance.sectionTitle')}>
        <SettingsSegmented
          value={themeMode}
          onChange={(value) => {
            if (isThemeMode(value)) void setThemeMode(value);
          }}
          buttons={THEME_MODE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            icon: option.icon,
          }))}
        />
        <Menu
          visible={languageMenuOpen}
          onDismiss={() => setLanguageMenuOpen(false)}
          anchor={
            <SettingsRow
              icon="translate"
              title={t('appearance.languageSectionTitle')}
              trailingValue={t(languageLabel)}
              chevron
              onPress={() => setLanguageMenuOpen(true)}
            />
          }
        >
          {APP_LANGUAGE_OPTIONS.map((option) => (
            <Menu.Item
              key={option.value}
              leadingIcon={appLanguage === option.value ? 'check' : undefined}
              title={t(option.labelKey)}
              onPress={() => void handleLanguageChange(option.value)}
            />
          ))}
        </Menu>
      </SettingsGroup>

      <SettingsGroup title={t('homeChrome.sectionTitle')}>
        <SettingsRow
          icon="weather-partly-cloudy"
          title={t('homeChrome.weatherTitle')}
          description={weatherSubtitle}
          switchValue={weatherWidgetEnabled}
          onSwitch={(value) => void handleWeatherToggle(value)}
        />
        {weatherWidgetEnabled ? (
          <SettingsRow
            icon="map-marker-outline"
            title={t('weather.locationTitle')}
            trailingValue={locationValue}
            chevron
            onPress={() => navigation.navigate('WeatherLocation')}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t('data.sectionTitle')} caption={t('data.caption')}>
        <SettingsRow
          icon="export"
          title={t('data.exportTitle')}
          description={t('data.exportDescription')}
          busy={busy}
          onPress={busy ? undefined : () => void handleExport()}
        />
        <SettingsRow
          icon="import"
          title={t('data.importTitle')}
          description={
            importAvailable
              ? t('data.importDescriptionAvailable')
              : t('data.importDescriptionUnavailable')
          }
          busy={busy}
          onPress={busy ? undefined : handleImport}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="delete-forever"
          title={t('data.clearDataTitle')}
          description={t('data.clearDataDescription')}
          destructive
          busy={busy}
          onPress={busy ? undefined : openClearSheet}
        />
        <SettingsRow
          icon="notebook-remove-outline"
          title={t('data.clearNotebookTitle')}
          description={t('data.clearNotebookDescription')}
          destructive
          disabled={busy || notebooks.length === 0}
          busy={clearNotebookBusy}
          onPress={
            busy || notebooks.length === 0 ? undefined : () => setClearNotebookVisible(true)
          }
        />
      </SettingsGroup>

      <View style={styles.about} accessibilityRole="text">
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('about.title')}
        </Text>
        <Text
          variant="labelSmall"
          style={[styles.aboutVersion, { color: theme.colors.onSurfaceVariant }]}
        >
          {t('about.version', { version: getAppVersion() })}
        </Text>
      </View>

      <ClearDataSheet
        visible={clearSheetVisible}
        busy={busy}
        onDismiss={dismissClearSheet}
        onConfirm={handleClearConfirm}
        onExportFirst={() => void handleExport()}
      />
      <ClearNotebookSheet
        visible={clearNotebookVisible}
        notebooks={notebooks}
        busy={clearNotebookBusy}
        onDismiss={() => setClearNotebookVisible(false)}
        onClear={handleClearNotebook}
      />
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
  about: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
  },
  aboutVersion: {},
});
