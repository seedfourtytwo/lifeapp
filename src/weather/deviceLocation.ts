import { NativeModules, Platform } from 'react-native';
import type { WeatherCoords } from './types';

type LocationModule = typeof import('expo-location');

let locationModule: LocationModule | null = null;
let locationUnavailable = false;

/** Avoid importing expo-location when the native module is missing (old dev client / web). */
export function isDeviceLocationAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return NativeModules.ExpoLocation != null;
}

async function getLocationModule(): Promise<LocationModule | null> {
  if (locationUnavailable || !isDeviceLocationAvailable()) {
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

  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
}
