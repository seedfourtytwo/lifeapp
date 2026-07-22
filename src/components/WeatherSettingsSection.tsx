import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import {
  getDeviceCoords,
  isDeviceLocationAvailable,
  requestDeviceLocationPermission,
} from '../weather/deviceLocation';
import { formatCoordLabel } from '../weather/format';
import { searchPlaces, type GeocodeHit } from '../weather/openMeteo';
import { classifyWeatherFetchError } from '../weather/errors';

export default function WeatherSettingsSection() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const setWeatherWidgetEnabled = useSettingsStore((s) => s.setWeatherWidgetEnabled);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const setWeatherLocationMode = useSettingsStore((s) => s.setWeatherLocationMode);
  const weatherPlaceName = useSettingsStore((s) => s.weatherPlaceName);
  const setWeatherPlace = useSettingsStore((s) => s.setWeatherPlace);
  const refreshWeather = useWeatherStore((s) => s.refresh);
  const clearWeather = useWeatherStore((s) => s.clear);

  const [placeQuery, setPlaceQuery] = useState(
    weatherLocationMode === 'manual' ? (weatherPlaceName ?? '') : '',
  );
  const [placeBusy, setPlaceBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [placeHits, setPlaceHits] = useState<GeocodeHit[]>([]);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const deviceLocationAvailable = isDeviceLocationAvailable();

  const deviceLocationDescription = !deviceLocationAvailable
    ? t('weather.descriptionRebuildRequired')
    : locating
      ? t('weather.descriptionLocating')
      : weatherLocationMode === 'device' && weatherPlaceName
        ? weatherPlaceName
        : weatherLocationMode === 'device'
          ? t('weather.descriptionUsingGps')
          : t('weather.descriptionPreferGps');

  const handleWeatherToggle = async (enabled: boolean) => {
    await setWeatherWidgetEnabled(enabled);
    if (enabled) {
      void refreshWeather({ force: true });
    } else {
      clearWeather();
    }
  };

  const handleUseDeviceLocation = async () => {
    if (locating) return;
    if (!deviceLocationAvailable) {
      Alert.alert(t('weather.rebuildRequiredTitle'), t('weather.rebuildRequiredBody'));
      return;
    }
    setLocating(true);
    try {
      const granted = await requestDeviceLocationPermission();
      if (!granted) {
        Alert.alert(t('weather.locationBlockedTitle'), t('weather.locationBlockedBody'));
        return;
      }
      const coords = await getDeviceCoords();
      if (!coords) {
        Alert.alert(t('weather.locationUnavailableTitle'), t('weather.locationUnavailableBody'));
        return;
      }
      const placeName = coords.placeName ?? formatCoordLabel(coords.lat, coords.lon);
      await setWeatherLocationMode('device');
      await setWeatherPlace({
        placeName,
        lat: coords.lat,
        lon: coords.lon,
      });
      // Keep city search empty — GPS place is shown under this row only.
      setPlaceQuery('');
      setPlaceHits([]);
      setPlaceSearchError(null);
      void refreshWeather({ force: true, refreshGps: true });
    } catch (error) {
      const kind = classifyWeatherFetchError(error);
      Alert.alert(
        t('weather.locationUnavailableTitle'),
        kind === 'offline'
          ? t('weather.locationUnavailableOfflineBody')
          : t('weather.locationUnavailableBody'),
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSearchPlaces = async () => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      Alert.alert(t('weather.cityRequiredTitle'), t('weather.cityRequiredBody'));
      return;
    }
    setPlaceBusy(true);
    setPlaceSearchError(null);
    setPlaceHits([]);
    try {
      const hits = await searchPlaces(query);
      if (hits.length === 0) {
        setPlaceSearchError(t('weather.noMatchesBody'));
        return;
      }
      setPlaceHits(hits);
    } catch (error) {
      const kind = classifyWeatherFetchError(error);
      setPlaceSearchError(
        kind === 'offline'
          ? t('weather.searchOfflineBody')
          : error instanceof Error
            ? error.message
            : t('weather.searchFailedBodyFallback'),
      );
    } finally {
      setPlaceBusy(false);
    }
  };

  const handleSelectPlace = async (hit: GeocodeHit) => {
    await setWeatherLocationMode('manual');
    await setWeatherPlace({
      placeName: hit.label,
      lat: hit.lat,
      lon: hit.lon,
    });
    setPlaceQuery(hit.label);
    setPlaceHits([]);
    setPlaceSearchError(null);
    void refreshWeather({ force: true });
  };

  return (
    <List.Section>
      <List.Subheader>{t('weather.sectionTitle')}</List.Subheader>
      <List.Item
        title={t('weather.widgetTitle')}
        description={t('weather.widgetDescription')}
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
            title={t('weather.usePhoneLocationTitle')}
            description={deviceLocationDescription}
            left={(props) => <List.Icon {...props} icon="crosshairs-gps" />}
            right={() =>
              locating ? (
                <ActivityIndicator
                  style={styles.locatingSpinner}
                  color={theme.colors.primary}
                  accessibilityLabel={t('weather.getLocationA11y')}
                />
              ) : null
            }
            disabled={locating}
            onPress={() => void handleUseDeviceLocation()}
            accessibilityHint={
              weatherLocationMode === 'device' && weatherPlaceName
                ? t('weather.refreshHint')
                : undefined
            }
          />
          <View style={styles.placeBlock}>
            <Text variant="bodySmall" style={styles.placeHint}>
              {t('weather.cityHint')}
            </Text>
            <TextInput
              mode="outlined"
              label={t('weather.cityLabel')}
              value={placeQuery}
              onChangeText={(text) => {
                setPlaceQuery(text);
                setPlaceHits([]);
                setPlaceSearchError(null);
              }}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => void handleSearchPlaces()}
              dense
            />
            {weatherPlaceName && weatherLocationMode === 'manual' ? (
              <Text variant="bodySmall" style={styles.placeCurrent}>
                {t('weather.savedPlace', { place: weatherPlaceName })}
              </Text>
            ) : null}
            <Button
              mode="contained-tonal"
              onPress={() => void handleSearchPlaces()}
              loading={placeBusy}
              disabled={placeBusy}
              style={styles.placeBtn}
              icon="magnify"
            >
              {t('weather.searchButton')}
            </Button>
            {placeSearchError ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {placeSearchError}
              </Text>
            ) : null}
            {placeHits.map((hit) => (
              <List.Item
                key={hit.id}
                title={hit.name}
                description={hit.label}
                left={(props) => <List.Icon {...props} icon="map-marker" />}
                onPress={() => void handleSelectPlace(hit)}
                style={styles.placeHit}
              />
            ))}
          </View>
        </>
      ) : null}
    </List.Section>
  );
}

const styles = StyleSheet.create({
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
  placeHit: {
    paddingHorizontal: 0,
    marginHorizontal: -8,
  },
  locatingSpinner: {
    alignSelf: 'center',
    marginRight: 8,
  },
});
