import React, { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ClearDataSheet from '../../components/ClearDataSheet';
import ClearNotebookSheet from '../../components/ClearNotebookSheet';
import SettingsGroup from '../../components/settings/SettingsGroup';
import SettingsRow from '../../components/settings/SettingsRow';
import SettingsSegmented from '../../components/settings/SettingsSegmented';
import { useProtocolBackup } from '../../hooks/useProtocolBackup';
import { applyAppLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { clearJournalNotebookEntries } from '../../notes/journalNotebooks';
import {
  isNotificationsNativeAvailable,
  requestNotificationPermissions,
} from '../../notifications/habitReminders';
import type { JournalNotebook } from '../../protocol';
import type { AppLanguage } from '../../protocol/appSettings';
import { useJournalNotebookStore } from '../../store/journalNotebookStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWeatherStore } from '../../store/weatherStore';
import { APP_LANGUAGE_OPTIONS, THEME_MODE_OPTIONS, isThemeMode } from '../../theme';
import { layout, space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { getAppVersion } from '../../utils/appVersion';
import { HomeTabScrollView } from '../shared/HomeTabScrollView';
import PageHeader from '../shared/PageHeader';
import { homeTabScreenStyles } from '../shared/screenStyles';
import CheckInTimeSheet from './CheckInTimeSheet';
import APP_ICON from '../../../assets/icon.png';
import { notify } from '../../components/sheet/confirm';

const ABOUT_ICON_SIZE = 40;

/**
 * The More page: what you manage, and how the app is set up, on one page. It
 * is the last page of the Home pager, not a pushed screen, so it carries its
 * own title where Today carries the date and scrolls through
 * `HomeTabScrollView`, which leaves the pager's horizontal gesture alone.
 *
 * It opens no database when it is built. Every value it shows is already in a
 * store — settings from startup, the notebooks from Home — and the
 * destinations behind its rows do their own loading when pushed. Keep it that
 * way: it is built the moment a drag begins beside it.
 */
function MoreScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setAppLanguage = useSettingsStore((s) => s.setAppLanguage);
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const setWeatherWidgetEnabled = useSettingsStore((s) => s.setWeatherWidgetEnabled);
  const weatherPlaceName = useSettingsStore((s) => s.weatherPlaceName);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const eveningCheckInEnabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const setEveningCheckInEnabled = useSettingsStore((s) => s.setEveningCheckInEnabled);
  const eveningCheckInTime = useSettingsStore((s) => s.eveningCheckInTime);
  const setEveningCheckInTime = useSettingsStore((s) => s.setEveningCheckInTime);
  const refreshWeather = useWeatherStore((s) => s.refresh);
  const clearWeather = useWeatherStore((s) => s.clear);
  const notebooks = useJournalNotebookStore((s) => s.notebooks);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [checkInTimeOpen, setCheckInTimeOpen] = useState(false);
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

  const languageLabel =
    APP_LANGUAGE_OPTIONS.find((option) => option.value === appLanguage)?.labelKey ??
    'appearance.languageSystem';

  const weatherSubtitle = weatherWidgetEnabled
    ? (weatherPlaceName ?? t('homeChrome.on'))
    : t('homeChrome.off');

  const locationValue =
    weatherLocationMode === 'device'
      ? t('weather.descriptionUsingGps')
      : (weatherPlaceName ?? undefined);

  const handleClearNotebook = async (notebook: JournalNotebook) => {
    setClearNotebookBusy(true);
    try {
      await clearJournalNotebookEntries(notebook.id);
      setClearNotebookVisible(false);
      void notify({
        title: t('data.clearNotebookDoneTitle'),
        message: t('data.clearNotebookDoneBody', { name: notebook.name }),
      });
    } catch {
      void notify({
        title: t('data.clearNotebookFailedTitle'),
        message: t('data.clearFailedBodyFallback'),
      });
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

  /**
   * Turning the check-in on asks for notification permission first: a switch
   * that reads "on" while the system drops every notification would be a lie.
   * Where this build has no notifications at all, the preference is still
   * kept — nothing can fire, and it travels with a backup.
   */
  const handleEveningCheckInToggle = async (enabled: boolean) => {
    if (enabled && isNotificationsNativeAvailable()) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        void notify({
          title: t('notifications:permissions.blockedTitle'),
          message: t('notifications:permissions.blockedBody'),
        });
        return;
      }
    }
    await setEveningCheckInEnabled(enabled);
  };

  return (
    <>
      <HomeTabScrollView
        contentContainerStyle={[homeTabScreenStyles.container, styles.container]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stack}>
          <PageHeader title={t('home:dock.more')} />

          <SettingsGroup title={t('menu.sectionTitle')}>
            <SettingsRow
              icon="checkbox-multiple-marked-outline"
              title={t('menu.trackersTitle')}
              chevron
              onPress={() => navigation.navigate('Trackers')}
            />
            <SettingsRow
              icon="clipboard-check-outline"
              title={t('menu.finishedTodosTitle')}
              chevron
              onPress={() => navigation.navigate('TodoHistory')}
            />
            <SettingsRow
              icon="silverware-fork-knife"
              title={t('menu.foodTitle')}
              chevron
              onPress={() => navigation.navigate('Nutrition')}
            />
            <SettingsRow
              icon="food-apple-outline"
              title={t('menu.ingredientsTitle')}
              chevron
              onPress={() => navigation.navigate('Ingredients')}
            />
          </SettingsGroup>

          <SettingsGroup title={t('appearance.sectionTitle')}>
            <SettingsSegmented
              value={themeMode}
              onChange={(value) => {
                if (isThemeMode(value)) void setThemeMode(value);
              }}
              buttons={THEME_MODE_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
            />
          </SettingsGroup>

          <SettingsGroup title={t('general.sectionTitle')}>
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

          <SettingsGroup title={t('reminders.sectionTitle')}>
            <SettingsRow
              icon="bell-outline"
              title={t('reminders.eveningTitle')}
              description={t('reminders.eveningDescription')}
              switchValue={eveningCheckInEnabled}
              onSwitch={(value) => void handleEveningCheckInToggle(value)}
            />
            {eveningCheckInEnabled ? (
              <SettingsRow
                icon="clock-outline"
                title={t('reminders.timeTitle')}
                trailingValue={eveningCheckInTime}
                chevron
                onPress={() => setCheckInTimeOpen(true)}
              />
            ) : null}
          </SettingsGroup>

          <SettingsGroup title={t('data.sectionTitle')}>
            <SettingsRow
              icon="cloud-upload-outline"
              title={t('data.exportTitle')}
              description={t('data.exportDescription')}
              busy={busy}
              onPress={busy ? undefined : () => void handleExport()}
            />
            <SettingsRow
              icon="cloud-download-outline"
              title={t('data.importTitle')}
              description={
                importAvailable
                  ? t('data.importDescriptionAvailable')
                  : t('data.importDescriptionUnavailable')
              }
              busy={busy}
              onPress={busy ? undefined : handleImport}
            />
            <SettingsRow
              icon="delete-outline"
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

          <View style={styles.about}>
            <Image source={APP_ICON} style={styles.aboutIcon} accessibilityIgnoresInvertColors />
            <Text style={[typeScale.caption, { color: theme.colors.onSurfaceVariant }]}>
              {t('about.version', { version: getAppVersion() })}
            </Text>
          </View>
        </View>
      </HomeTabScrollView>

      <CheckInTimeSheet
        visible={checkInTimeOpen}
        value={eveningCheckInTime}
        onDismiss={() => setCheckInTimeOpen(false)}
        onSave={setEveningCheckInTime}
      />
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: space.xxl,
  },
  /** The scroll view wraps its children in one box, so the gap lives here. */
  stack: {
    gap: layout.sectionGap,
  },
  about: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.lg,
  },
  aboutIcon: {
    width: ABOUT_ICON_SIZE,
    height: ABOUT_ICON_SIZE,
    // Half the size: the icon is drawn as a disc, like on the home screen.
    borderRadius: ABOUT_ICON_SIZE / 2,
  },
});

/**
 * Memoised because it takes no props: a Home page change re-renders HomeScreen,
 * and this page has no reason to follow it.
 */
export default memo(MoreScreen);
