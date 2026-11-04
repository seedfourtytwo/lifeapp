/**
 * Cartoon was retired in 1.6.0: it was the single biggest "toy" signal and
 * tripled every visual check. Nothing in the app may branch on it again. Old
 * values still load (see themeResolution.test.ts); only the look is gone.
 */
describe('the cartoon theme', () => {
  const { readdirSync, readFileSync, statSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
  const { join } = jest.requireActual<typeof import('node:path')>('node:path');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(tsx?|json)$/.test(name) ? [path] : [];
    });

  it('is gone from the source, apart from the read-time migration', () => {
    const offenders = walk(join(__dirname, '../src')).filter((file) => {
      if (file.endsWith('protocol/appSettings.ts')) return false;
      return /cartoon/i.test(readFileSync(file, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });
});
