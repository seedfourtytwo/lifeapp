import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { formatCoordLabel } from './format';
import type { WeatherCoords } from './types';

type LocationModule = typeof import('expo-location');

let locationModule: LocationModule | null = null;
let locationUnavailable = false;

/** Expo modules are not exposed on NativeModules — use the optional JSI lookup. */
export function isDeviceLocationAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return requireOptionalNativeModule('ExpoLocation') != null;
}

async function getLocationModule(): Promise<LocationModule | null> {
  if (locationUnavailable) return null;
  if (!isDeviceLocationAvailable()) {
    locationUnavailable = true;
    return null;
  }
  if (locationModule) return locationModule;

  try {
    locationModule = await import('expo-location');
    return locationModule;
  } catch {
    locationUnavailable = true;
    return null;
  }
}

export async function requestDeviceLocationPermission(): Promise<boolean> {
  const Location = await getLocationModule();
  if (!Location) return false;

  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export async function getDeviceCoords(): Promise<WeatherCoords | null> {
  const Location = await getLocationModule();
  if (!Location) return null;

  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const placeName = await reverseGeocodeLabel(Location, lat, lon);

  return { lat, lon, placeName };
}

async function reverseGeocodeLabel(
  Location: LocationModule,
  lat: number,
  lon: number,
): Promise<string> {
  try {
    const hits = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const hit = hits[0];
    if (!hit) return formatCoordLabel(lat, lon);

    const parts = [hit.city ?? hit.subregion ?? hit.district, hit.region, hit.country].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    if (parts.length === 0) return formatCoordLabel(lat, lon);
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[parts.length - 1]}`;
    }
    return parts[0]!;
  } catch {
    return formatCoordLabel(lat, lon);
  }
}
