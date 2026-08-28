/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { nextRelease, compareVersions } = require('../scripts/release.js') as {
  nextRelease: (
    current: { version: string; versionCode: number },
    request: string,
  ) => { version: string; versionCode: number };
  compareVersions: (a: string, b: string) => number;
};

const current = { version: '1.5.0', versionCode: 24 };

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.5.0', '1.5.0')).toBe(0);
    expect(compareVersions('1.5.1', '1.5.0')).toBe(1);
    expect(compareVersions('1.6.0', '1.5.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.5.0', '1.5.1')).toBe(-1);
  });

  it('compares numerically, not as strings', () => {
    // '10' < '9' as strings; the whole point of parsing.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
  });
});

describe('nextRelease', () => {
  it('bumps patch, minor and major', () => {
    expect(nextRelease(current, 'patch').version).toBe('1.5.1');
    expect(nextRelease(current, 'minor').version).toBe('1.6.0');
    expect(nextRelease(current, 'major').version).toBe('2.0.0');
  });

  it('resets lower components when bumping', () => {
    const from = { version: '1.5.7', versionCode: 24 };
    expect(nextRelease(from, 'minor').version).toBe('1.6.0');
    expect(nextRelease(from, 'major').version).toBe('2.0.0');
  });

  it('accepts an explicit version', () => {
    expect(nextRelease(current, '2.1.3').version).toBe('2.1.3');
  });

  it('always increments versionCode by one', () => {
    // Play Store rejects a reused code, so this must move on every release.
    expect(nextRelease(current, 'patch').versionCode).toBe(25);
    expect(nextRelease(current, 'major').versionCode).toBe(25);
    expect(nextRelease(current, '9.9.9').versionCode).toBe(25);
  });

  it('refuses a version that is not greater than the current one', () => {
    expect(() => nextRelease(current, '1.5.0')).toThrow(/greater than 1\.5\.0/);
    expect(() => nextRelease(current, '1.4.9')).toThrow(/greater than 1\.5\.0/);
  });

  it('rejects malformed input', () => {
    expect(() => nextRelease(current, '1.5')).toThrow(/major\.minor\.patch/);
    expect(() => nextRelease(current, 'v1.6.0')).toThrow(/major\.minor\.patch/);
    expect(() => nextRelease(current, '1.6.0-beta')).toThrow(/major\.minor\.patch/);
    expect(() => nextRelease(current, '')).toThrow(/major\.minor\.patch/);
  });

  it('rejects a corrupt current version rather than guessing', () => {
    expect(() => nextRelease({ version: 'x', versionCode: 1 }, 'patch')).toThrow(
      /major\.minor\.patch/,
    );
  });

  it('rejects a non-integer current versionCode', () => {
    expect(() =>
      nextRelease({ version: '1.5.0', versionCode: 1.5 }, 'patch'),
    ).toThrow(/versionCode/);
  });
});
