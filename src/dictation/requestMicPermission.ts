import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Mic access for in-app Moonshine capture.
 * Check first on Android — requesting an already-granted RECORD_AUDIO can
 * return an empty grant list (GrapheneOS logs "No requestable permission").
 */
export async function requestDictationMicPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (already) return true;
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    const { Audio } = await import('expo-av');
    const result = await Audio.requestPermissionsAsync();
    return result.granted === true;
  } catch {
    return false;
  }
}
