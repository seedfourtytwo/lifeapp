import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import SettingsGroup from '../../components/settings/SettingsGroup';
import SettingsRow from '../../components/settings/SettingsRow';
import { useSettingsStore } from '../../store/settingsStore';
import { useWeatherStore } from '../../store/weatherStore';
import {
  getDeviceCoords,
  isDeviceLocationAvailable,
  requestDeviceLocationPermission,
} from '../../weather/deviceLocation';
import { formatCoordLabel } from '../../weather/format';
import { searchPlaces, type GeocodeHit } from '../../weather/openMeteo';
import { classifyWeatherFetchError } from '../../weather/errors';

export default function WeatherLocationScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const setWeatherLocationMode = useSettingsStore((s) => s.setWeatherLocationMode);
  const weatherPlaceName = useSettingsStore((s) => s.weatherPlaceName);
  const setWeatherPlace = useSettingsStore((s) => s.setWeatherPlace);
  const refreshWeather = useWeatherStore((s) => s.refresh);

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

  const handleUseDeviceLocation = async () => {
    if (locating) return;
    if (!deviceLocationAvailable) {
      Alert.alert(t('common:alerts.rebuildRequiredTitle'), t('weather.rebuildRequiredBody'));
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SettingsGroup>
        <SettingsRow
          icon="crosshairs-gps"
          title={t('weather.usePhoneLocationTitle')}
          description={deviceLocationDescription}
          busy={locating}
          disabled={locating}
          onPress={() => void handleUseDeviceLocation()}
          accessibilityHint={
            weatherLocationMode === 'device' && weatherPlaceName
              ? t('weather.refreshHint')
              : undefined
          }
        />
        <View style={styles.placeBlock}>
          <Text variant="bodySmall" style={[styles.placeHint, { color: theme.colors.onSurfaceVariant }]}>
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
            <QuietText variant="bodySmall" style={styles.placeCurrent}>
              {t('weather.savedPlace', { place: weatherPlaceName })}
            </QuietText>
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
        </View>
        {placeHits.map((hit) => (
          <SettingsRow
            key={hit.id}
            icon="map-marker"
            title={hit.name}
            description={hit.label}
            onPress={() => void handleSelectPlace(hit)}
          />
        ))}
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
  placeBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
  },
  placeHint: {},
  placeCurrent: {},
  placeBtn: {
    alignSelf: 'flex-start',
  },
});
