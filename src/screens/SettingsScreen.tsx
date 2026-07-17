import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  List,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useProtocolBackup } from '../hooks/useProtocolBackup';
import {
  requestNotificationPermissions,
  isNotificationsNativeAvailable,
} from '../notifications/habitReminders';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { THEME_MODE_OPTIONS } from '../theme';
import {
  getDeviceCoords,
  isDeviceLocationAvailable,
  requestDeviceLocationPermission,
} from '../weather/deviceLocation';
import { geocodePlace } from '../weather/openMeteo';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const setHabitRemindersEnabled = useSettingsStore((s) => s.setHabitRemindersEnabled);
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const setWeatherWidgetEnabled = useSettingsStore((s) => s.setWeatherWidgetEnabled);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const setWeatherLocationMode = useSettingsStore((s) => s.setWeatherLocationMode);
  const weatherPlaceName = useSettingsStore((s) => s.weatherPlaceName);
  const setWeatherPlace = useSettingsStore((s) => s.setWeatherPlace);
  const refreshWeather = useWeatherStore((s) => s.refresh);
  const clearWeather = useWeatherStore((s) => s.clear);
  const { busy, importAvailable, handleExport, handleImport, handleClearAllData } =
    useProtocolBackup();

  const [placeQuery, setPlaceQuery] = useState(weatherPlaceName ?? '');
  const [placeBusy, setPlaceBusy] = useState(false);
  const deviceLocationAvailable = isDeviceLocationAvailable();

  const handleRemindersToggle = async (enabled: boolean) => {
    if (enabled && !isNotificationsNativeAvailable()) {
      Alert.alert(
        'Rebuild required',
        'Habit reminders need a fresh dev build. Run: npx expo run:android',
      );
      return;
    }
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications in system settings to get habit reminders.',
        );
        return;
      }
    }
    await setHabitRemindersEnabled(enabled);
  };

  const handleWeatherToggle = async (enabled: boolean) => {
    await setWeatherWidgetEnabled(enabled);
    if (enabled) {
      void refreshWeather({ force: true });
    } else {
      clearWeather();
    }
  };

  const handleUseDeviceLocation = async () => {
    if (!deviceLocationAvailable) {
      Alert.alert(
        'Rebuild required',
        'Phone location needs a fresh dev build with expo-location. You can set a city manually below.',
      );
      return;
    }
    const granted = await requestDeviceLocationPermission();
    if (!granted) {
      Alert.alert(
        'Location blocked',
        'Enable location permission in system settings, or set a city manually.',
      );
      return;
    }
    const coords = await getDeviceCoords();
    if (!coords) {
      Alert.alert('Location unavailable', 'Could not read device location. Try a city name instead.');
      return;
    }
    await setWeatherLocationMode('device');
    await setWeatherPlace({
      placeName: weatherPlaceName ?? 'Current location',
      lat: coords.lat,
      lon: coords.lon,
    });
    void refreshWeather({ force: true });
  };

  const handleSavePlace = async () => {
    const query = placeQuery.trim();
    if (!query) {
      Alert.alert('City required', 'Enter a city name to look up weather.');
      return;
    }
    setPlaceBusy(true);
    try {
      const hit = await geocodePlace(query);
      if (!hit) {
        Alert.alert('Not found', 'No place matched that name. Try another spelling.');
        return;
      }
      await setWeatherLocationMode('manual');
      await setWeatherPlace({
        placeName: hit.placeName ?? query,
        lat: hit.lat,
        lon: hit.lon,
      });
      setPlaceQuery(hit.placeName ?? query);
      void refreshWeather({ force: true });
    } catch (error) {
      Alert.alert(
        'Lookup failed',
        error instanceof Error ? error.message : 'Could not look up that place.',
      );
    } finally {
      setPlaceBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
        <List.Subheader>Weather</List.Subheader>
        <List.Item
          title="Home weather bubble"
          description="Show a movable temp bubble on Home"
          left={(props) => <List.Icon {...props} icon="weather-partly-cloudy" />}
          right={() => (
            <Switch
              value={weatherWidgetEnabled}
              onValueChange={(value) => void handleWeatherToggle(value)}
            />
          )}
        />
        {weatherWidgetEnabled ? (
          <>
            <List.Item
              title="Use phone location"
              description={
                deviceLocationAvailable
                  ? weatherLocationMode === 'device'
                    ? 'Using device GPS'
                    : 'Prefer GPS when permitted'
                  : 'Needs a fresh Android build — use a city below'
              }
              left={(props) => <List.Icon {...props} icon="crosshairs-gps" />}
              onPress={() => void handleUseDeviceLocation()}
            />
            <View style={styles.placeBlock}>
              <Text variant="bodySmall" style={styles.placeHint}>
                Or set a city manually
              </Text>
              <TextInput
                mode="outlined"
                label="City"
                value={placeQuery}
                onChangeText={setPlaceQuery}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={() => void handleSavePlace()}
                dense
              />
              {weatherPlaceName ? (
                <Text variant="bodySmall" style={styles.placeCurrent}>
                  Saved: {weatherPlaceName}
                  {weatherLocationMode === 'manual' ? ' (manual)' : ''}
                </Text>
              ) : null}
              <Button
                mode="contained-tonal"
                onPress={() => void handleSavePlace()}
                loading={placeBusy}
                disabled={placeBusy}
                style={styles.placeBtn}
              >
                Save city
              </Button>
            </View>
          </>
        ) : null}
      </List.Section>

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Habit reminders"
          description="Remind before scheduled habits and at 8 PM if habits remain"
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={() => (
            <Switch
              value={habitRemindersEnabled}
              onValueChange={(value) => void handleRemindersToggle(value)}
            />
          )}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Data</List.Subheader>
        <List.Item
          title="Export backup"
          description="Save habits, counters, history, and app preferences as JSON"
          left={(props) => <List.Icon {...props} icon="export" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : () => void handleExport()}
        />
        <List.Item
          title="Import backup"
          description={
            importAvailable
              ? 'Replace this device with a backup file'
              : 'Needs dev client rebuild — export works now'
          }
          left={(props) => <List.Icon {...props} icon="import" />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : handleImport}
        />
        <List.Item
          title="Delete all data"
          description="Erase habits, counters, history, and preferences"
          left={(props) => <List.Icon {...props} icon="delete-forever" color={theme.colors.error} />}
          right={() => (busy ? <ActivityIndicator size={20} /> : null)}
          onPress={busy ? undefined : handleClearAllData}
        />
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
          Backups are JSON files you can move between installs. Import replaces all local data.
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
  placeBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  placeHint: {
    opacity: 0.7,
  },
  placeCurrent: {
    opacity: 0.7,
  },
  placeBtn: {
    alignSelf: 'flex-start',
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
