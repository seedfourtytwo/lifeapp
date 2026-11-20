/**
 * Source guard: nothing in `src` opens the stock dialog.
 *
 * `Alert.alert` with buttons is a no-op on the web build — a restore or a
 * delete there could never be confirmed — and on Android it is the one surface
 * that is not the app's own. Questions go through `confirm()`, notices through
 * `notify()` (`src/components/sheet/confirm.ts`), both drawn by `ConfirmSheet`.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('stock dialogs', () => {
  const files = sourceFiles(SRC).map((file) => ({
    rel: file.replace(`${SRC}/`, 'src/'),
    body: readFileSync(file, 'utf8'),
  }));

  it('scans the source at all', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('are not opened anywhere in the source', () => {
    const offenders = files
      .filter(({ body }) => /\bAlert\.alert\s*\(/.test(body))
      .map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });
});
