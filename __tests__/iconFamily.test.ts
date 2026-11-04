/**
 * One icon family: outline glyphs at rest, the filled twin only where the
 * state is "on" (the active dock page, a done disc). A wrong glyph name does
 * not fail anywhere else — MaterialCommunityIcons draws a "?" box — so every
 * name the app maps to is checked against the font's own glyph map here.
 */
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { TRACKER_ICON_IDS, isCustomTrackerIconId } from '../src/protocol';
import { TRACKER_OUTLINE_GLYPHS, trackerGlyphName } from '../src/components/trackerIcons/trackerGlyph';
import { HOME_DOCK_ITEMS } from '../src/screens/home/homePager';

const exists = (name: string) => Object.prototype.hasOwnProperty.call(glyphMap, name);
const glyphIds = TRACKER_ICON_IDS.filter((id) => !isCustomTrackerIconId(id));

describe('tracker glyphs', () => {
  it.each(glyphIds)('%s draws a real glyph, at rest and filled', (id) => {
    expect(exists(trackerGlyphName(id, false))).toBe(true);
    expect(exists(trackerGlyphName(id, true))).toBe(true);
  });

  it.each(Object.entries(TRACKER_OUTLINE_GLYPHS))(
    '%s rests as its own outline twin, %s',
    (id, outline) => {
      expect(outline).toBe(`${id}-outline`);
      expect(exists(outline)).toBe(true);
    },
  );

  it('rests on the outline wherever the font has one', () => {
    const missed = glyphIds.filter(
      (id) => !id.endsWith('-outline') && exists(`${id}-outline`) && trackerGlyphName(id, false) === id,
    );
    expect(missed).toEqual([]);
  });

  it('fills a done glyph back in', () => {
    expect(trackerGlyphName('water', false)).toBe('water-outline');
    expect(trackerGlyphName('water', true)).toBe('water');
  });
});

describe('dock', () => {
  it.each(HOME_DOCK_ITEMS.map((item) => [item.value, item] as const))(
    '%s rests on an outline and fills when active',
    (_value, item) => {
      expect(item.icon.endsWith('-outline')).toBe(true);
      expect(item.activeIcon).toBe(item.icon.replace(/-outline$/, ''));
      expect(exists(item.icon)).toBe(true);
      expect(exists(item.activeIcon)).toBe(true);
    },
  );
});
