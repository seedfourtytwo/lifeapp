/**
 * One icon family: outline glyphs at rest. A wrong glyph name does not fail
 * anywhere else — MaterialCommunityIcons draws a "?" box — so every name the
 * app maps to is checked against the font's own glyph map here.
 */
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { TRACKER_ICON_IDS, isCustomTrackerIconId } from '../src/protocol';
import { TRACKER_OUTLINE_GLYPHS, trackerGlyphName } from '../src/components/trackerIcons/trackerGlyph';

const exists = (name: string) => Object.prototype.hasOwnProperty.call(glyphMap, name);
const glyphIds = TRACKER_ICON_IDS.filter((id) => !isCustomTrackerIconId(id));

describe('tracker glyphs', () => {
  it.each(glyphIds)('%s draws a real glyph', (id) => {
    expect(exists(trackerGlyphName(id))).toBe(true);
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
      (id) => !id.endsWith('-outline') && exists(`${id}-outline`) && trackerGlyphName(id) === id,
    );
    expect(missed).toEqual([]);
  });

  it('draws the outline twin, and the stored glyph where there is none', () => {
    expect(trackerGlyphName('water')).toBe('water-outline');
    expect(trackerGlyphName('dumbbell')).toBe('dumbbell');
  });
});
