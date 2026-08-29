/**
 * Source guard: text is never dimmed with `opacity`.
 *
 * Lowering opacity over a colour token that is *already* the muted one
 * compounds: 0.6 over `onSurfaceVariant` lands near 2.2:1, and even 0.85 fails
 * on the light background. See `themeContrast.test.ts` for the numbers.
 *
 * Opacity is still the right tool for whole-container state — a pressed row, a
 * disabled scope, a card dimmed because it is out of its time window. Those
 * live in the allowlist below, which is the point of this test: adding a new
 * `opacity` means naming which kind it is.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

/**
 * Style keys (and inline contexts) where opacity means "this whole control is
 * inactive / being pressed / decorative", not "this text is secondary".
 */
const CONTAINER_STATE_KEYS = new Set([
  // Whole-control state.
  'pressed',
  'disabled',
  'disabledRow',
  'scopeRow',
  'dimmedCard',
  // Decorative fills behind content — no text takes its colour from these.
  'aura',
  'wash',
  'sheen',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * The style key an `opacity` line belongs to: the nearest `name: {` above it
 * that is still open. Good enough for StyleSheet literals, which is the only
 * shape this codebase uses; inline `{ opacity: … }` returns the enclosing JSX
 * prop instead and is reported as `inline`.
 */
function enclosingKey(lines: string[], index: number): string {
  // A one-liner entry carries its own key: `pressed: { opacity: 0.7 },`
  const inline = lines[index]!.match(/^\s*([A-Za-z0-9_]+)\s*:\s*\{[^}]*opacity/);
  if (inline) return inline[1]!;

  for (let i = index; i >= 0; i -= 1) {
    const line = lines[i]!;

    // StyleSheet entry: `name: {`
    const entry = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*\{\s*$/);
    if (entry) return entry[1]!;

    // Overrides merged onto a named style: `style={[styles.wash, { … }]}`
    const merged = line.match(/styles\.([A-Za-z0-9_]+)\s*,\s*$/);
    if (merged) return merged[1]!;

    if (/style=\{\{/.test(line) || /&&\s*\{\s*opacity/.test(line)) return 'inline';
  }
  return 'unknown';
}

describe('no text is dimmed with opacity', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      // Skip prose in comments — this rule is explained in several docblocks.
      if (/^\s*\*/.test(line) || /^\s*\/\//.test(line)) return;
      if (!/\bopacity:\s*[0-9.]/.test(line)) return;

      const key = enclosingKey(lines, index);
      if (CONTAINER_STATE_KEYS.has(key)) return;

      // An inline `disabled && { opacity }` guard is container state too.
      if (key === 'inline' && /disabled|pressed/.test(lines[index]!)) return;

      offenders.push(
        `${file.replace(`${SRC}/`, 'src/')}:${index + 1}  (${key})  ${line.trim()}`,
      );
    });
  }

  it('has no opacity outside the container-state allowlist', () => {
    expect(offenders).toEqual([]);
  });
});
