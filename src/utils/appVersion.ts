import Constants from 'expo-constants';

/** Installed native version, then Expo config, then the repo fallback. */
export function getAppVersion(): string {
  return (
    Constants.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '1.4.2'
  );
}
