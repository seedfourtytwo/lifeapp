/**
 * Source guard: every animated module answers to "remove animations".
 *
 * Android exposes this in Settings → Accessibility, and a phone that asks for
 * it means it. Before this guard existed one component out of eight honoured
 * the setting, and the ones that ignored it included the loudest things in the
 * app — a confetti burst and an edge flash, both since retired with the
 * floating weather bubble.
 *
 * A module clears the bar by reaching the setting at all: `useReduceMotion`
 * directly, or the `springOrSnap` / `timingOrSnap` helpers that take it as an
 * argument. *How* to honour it is a judgement per component, and the two
 * answers are written down in `src/utils/motion.ts`: skip an effect that says
 * nothing on its own, snap one that does.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

/**
 * Drives real movement, as opposed to just holding a value. The two helpers
 * count: a module that moved to them still animates, it just asks first.
 */
const ANIMATION_CALL =
  /Animated\.(timing|spring|loop|sequence|parallel|decay)\s*\(|(spring|timing)OrSnap\s*\(/;

const REACHES_THE_SETTING = /useReduceMotion|springOrSnap|timingOrSnap/;

/**
 * Files allowed to call `Animated.*` without consulting the setting, each for
 * a reason that has to survive being written down.
 */
const EXEMPT = new Map<string, string>([
  [
    'src/utils/motion.ts',
    'Defines the helpers; takes reduceMotion as an argument.',
  ],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('animated modules respect reduced motion', () => {
  const animated: string[] = [];
  const ignoring: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const rel = file.replace(`${SRC}/`, 'src/');
    const body = readFileSync(file, 'utf8');
    if (!ANIMATION_CALL.test(body)) continue;

    animated.push(rel);
    if (EXEMPT.has(rel)) continue;
    if (!REACHES_THE_SETTING.test(body)) ignoring.push(rel);
  }

  it('finds the animated modules at all', () => {
    // Guards the guard: if the pattern stops matching, this drops to zero and
    // the assertion below would pass vacuously. The floor is deliberately
    // below the current count — retiring an animation is allowed, silently
    // losing the whole scan is not.
    expect(animated.length).toBeGreaterThanOrEqual(5);
  });

  it('has no animated module that ignores the setting', () => {
    expect(ignoring).toEqual([]);
  });
});
