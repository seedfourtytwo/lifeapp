import appJson from '../app.json';
import packageJson from '../package.json';
import { getAppVersion } from '../src/utils/appVersion';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// Not a static import: the lockfile is large and only these two fields matter.
const lockJson = require('../package-lock.json') as {
  version: string;
  packages: Record<string, { version?: string }>;
};
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

const VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * The release version lives in `app.json` and is copied into `package.json` by
 * `npm run release`. These assertions are what stops the copy drifting again —
 * before this guard existed, package.json sat a minor release behind for months.
 */
describe('release version consistency', () => {
  it('app.json carries a plain major.minor.patch version', () => {
    expect(appJson.expo.version).toMatch(VERSION_RE);
  });

  it('package.json matches app.json', () => {
    expect(packageJson.version).toBe(appJson.expo.version);
  });

  it('package-lock.json matches app.json in both places npm ci checks', () => {
    // A stale lock version makes `npm ci` refuse to install at all.
    expect(lockJson.version).toBe(appJson.expo.version);
    expect(lockJson.packages['']?.version).toBe(appJson.expo.version);
  });

  it('android versionCode is a positive integer', () => {
    const { versionCode } = appJson.expo.android;
    expect(Number.isInteger(versionCode)).toBe(true);
    expect(versionCode).toBeGreaterThan(0);
  });
});

describe('getAppVersion', () => {
  it('falls back to the bundled app.json version, not a hand-written literal', () => {
    // expo-constants is mocked in tests, so neither runtime source resolves and
    // the bundled fallback is what shows on the About screen.
    expect(getAppVersion()).toBe(appJson.expo.version);
  });
});
