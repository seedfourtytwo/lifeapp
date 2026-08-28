import Constants from 'expo-constants';
// Bundled at build time from the same file Expo itself reads, so this can never
// drift from the shipped version the way a hand-written literal did.
import appJson from '../../app.json';

/**
 * Installed native version, then the Expo config, then the bundled `app.json`.
 *
 * `app.json` -> `expo.version` is the single source of truth for a release;
 * bump it with `npm run release -- <major|minor|patch|x.y.z>`, never by hand.
 */
export function getAppVersion(): string {
  return (
    Constants.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    appJson.expo.version
  );
}
