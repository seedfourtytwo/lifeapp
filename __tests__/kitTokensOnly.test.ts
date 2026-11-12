/**
 * Source guard: the Night road kit and every screen rebuilt on it take their
 * look from `src/ui/tokens.ts` and nothing else.
 *
 * Fails on, in any file under `src/ui/` (but the tokens themselves) or a
 * screen listed below:
 *  - a literal colour (`#…`, `rgb(…)`, a colour name);
 *  - a literal spacing, radius, font size or line height;
 *  - a React Native Paper import;
 *  - `Alert.alert` (the kit's ConfirmSheet and undo bar replace it).
 *
 * Zero is allowed: it is the absence of a gap, not a size. A screen joins the
 * list when it is rebuilt, and never leaves it.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');
const UI = join(ROOT, 'src', 'ui');
const TOKENS = join(UI, 'tokens.ts');

/** Screens rebuilt on the kit. */
const REBUILT = [
  'src/screens/UrgeScreen.tsx',
  'src/screens/urge/InsteadTimer.tsx',
  'src/screens/dev/KitGallery.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const SIZE_KEYS =
  '(?:margin|padding)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?|gap|rowGap|columnGap|' +
  'border(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius|fontSize|lineHeight';

const RULES: [string, RegExp][] = [
  ['literal colour', /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(|['"](?:white|black|red|grey|gray)['"]/],
  ['literal size', new RegExp(`\\b(?:${SIZE_KEYS})\\s*:\\s*-?(?:[1-9]\\d*(?:\\.\\d+)?|0\\.\\d+)\\b`)],
  ['Paper import', /from\s+['"]react-native-paper['"]/],
  ['Alert.alert', /\bAlert\.alert\s*\(/],
];

function offenders(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => {
      // Prose in comments explains these rules; it does not break them.
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return [];
      return RULES.filter(([, pattern]) => pattern.test(line)).map(
        ([rule]) => `${relative(ROOT, file)}:${index + 1}  ${rule}  ${line.trim()}`,
      );
    });
}

describe('the kit and rebuilt screens use the tokens only', () => {
  const files = [...sourceFiles(UI).filter((file) => file !== TOKENS), ...REBUILT.map((path) => join(ROOT, path))];

  it('finds the files it guards', () => {
    // Guards the guard: an empty scan would pass vacuously.
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const path of REBUILT) expect(statSync(join(ROOT, path)).isFile()).toBe(true);
  });

  it('has no literal colour, size, Paper import or system alert', () => {
    expect(files.flatMap(offenders)).toEqual([]);
  });

  it('catches each kind of breach', () => {
    const sample = (line: string) => RULES.filter(([, pattern]) => pattern.test(line)).map(([rule]) => rule);
    expect(sample("color: '#EFE9DC',")).toEqual(['literal colour']);
    expect(sample("backgroundColor: 'rgba(0,0,0,0.3)',")).toEqual(['literal colour']);
    expect(sample('paddingHorizontal: 14,')).toEqual(['literal size']);
    expect(sample('borderTopLeftRadius: 30,')).toEqual(['literal size']);
    expect(sample('fontSize: 13,')).toEqual(['literal size']);
    expect(sample("import { Text } from 'react-native-paper';")).toEqual(['Paper import']);
    expect(sample('Alert.alert(title);')).toEqual(['Alert.alert']);
    expect(sample('margin: 0,')).toEqual([]);
    expect(sample('gap: space.md,')).toEqual([]);
  });
});
