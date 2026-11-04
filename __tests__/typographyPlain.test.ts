/**
 * No type role respaces or recases its face. Letter-spacing and all-caps were
 * both making lines look like labels rather than read as words, and at arm's
 * length they cost more legibility than they bought character.
 */
import { typeScale } from '../src/theme/typography';

describe.each(Object.entries(typeScale))('%s', (_role, style) => {
  it('sets no letterSpacing', () => {
    expect(style).not.toHaveProperty('letterSpacing');
  });
  it('sets no textTransform', () => {
    expect(style).not.toHaveProperty('textTransform');
  });
});

describe('source', () => {
  const { readdirSync, readFileSync, statSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
  const { join } = jest.requireActual<typeof import('node:path')>('node:path');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });

  it('never uppercases or letter-spaces text', () => {
    const offenders = walk(join(__dirname, '../src')).filter((file) =>
      /textTransform: 'uppercase'|letterSpacing:/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
