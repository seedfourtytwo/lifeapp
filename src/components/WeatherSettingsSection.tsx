import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Button, List, Switch, Text, TextInput, useTheme } from 'react-native-paper';
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
    ? 'Needs a fresh Android build — use a city below'
    : locating
      ? 'Getting location…'
      : weatherLocationMode === 'device' && weatherPlaceName
        ? weatherPlaceName
        : weatherLocationMode === 'device'
          ? 'Using device GPS'
          : 'Prefer GPS when permitted';

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
      Alert.alert(
        'Rebuild required',
        'Phone location needs a fresh dev build with expo-location. You can set a city manually below.',
      );
      return;
    }
    setLocating(true);
    try {
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
        Alert.alert(
          'Location unavailable',
          'Could not read device location. Try a city name instead.',
        );
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
        'Location unavailable',
        kind === 'offline'
          ? 'No connection while resolving location. Try again online, or search a city.'
          : 'Could not read device location. Try a city name instead.',
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSearchPlaces = async () => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      Alert.alert('City required', 'Type at least 2 letters, then tap Search.');
      return;
    }
    setPlaceBusy(true);
    setPlaceSearchError(null);
    setPlaceHits([]);
    try {
      const hits = await searchPlaces(query);
      if (hits.length === 0) {
        setPlaceSearchError(
          'No matches. Try just the city name (e.g. Munich), not “City Country”.',
        );
        return;
      }
      setPlaceHits(hits);
    } catch (error) {
      const kind = classifyWeatherFetchError(error);
      setPlaceSearchError(
        kind === 'offline'
          ? 'No connection — city search needs the internet.'
          : error instanceof Error
            ? error.message
            : 'Could not search places.',
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
            description={deviceLocationDescription}
            left={(props) => <List.Icon {...props} icon="crosshairs-gps" />}
            right={() =>
              locating ? (
                <ActivityIndicator
                  style={styles.locatingSpinner}
                  color={theme.colors.primary}
                  accessibilityLabel="Getting location"
                />
              ) : null
            }
            disabled={locating}
            onPress={() => void handleUseDeviceLocation()}
            accessibilityHint={
              weatherLocationMode === 'device' && weatherPlaceName
                ? 'Tap again to refresh phone location'
                : undefined
            }
          />
          <View style={styles.placeBlock}>
            <Text variant="bodySmall" style={styles.placeHint}>
              Or search a city, then pick the correct match
            </Text>
            <TextInput
              mode="outlined"
              label="City"
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
                Saved: {weatherPlaceName}
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
              Search
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
