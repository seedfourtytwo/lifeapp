import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resources } from '../src/i18n';

// French readers must never fall back to English silently: every English
// namespace and key has a French twin, and the French side holds nothing stale.
const LOCALES = join(__dirname, '../src/i18n/locales');

type Tree = { [key: string]: string | Tree };

/** Leaf paths, with i18next plural suffixes folded so `_one`/`_many` may differ by language. */
function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix + k.replace(/_(zero|one|two|few|many|other)$/, '');
    return typeof v === 'string' ? [path] : keys(v, `${path}.`);
  });
}

const read = (lang: string, file: string): Tree =>
  JSON.parse(readFileSync(join(LOCALES, lang, file), 'utf8')) as Tree;

describe('EN and FR copy stay in step', () => {
  const enFiles = readdirSync(join(LOCALES, 'en')).sort();

  it('ships the same namespace files in both languages', () => {
    expect(readdirSync(join(LOCALES, 'fr')).sort()).toEqual(enFiles);
  });

  it('registers every namespace for both languages', () => {
    expect(Object.keys(resources.fr).sort()).toEqual(Object.keys(resources.en).sort());
  });

  it.each(enFiles)('%s has the same keys in French', (file) => {
    const en = [...new Set(keys(read('en', file)))].sort();
    const fr = [...new Set(keys(read('fr', file)))].sort();
    expect(fr).toEqual(en);
  });
});
