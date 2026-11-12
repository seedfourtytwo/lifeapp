import * as fs from 'node:fs';
import * as path from 'node:path';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { TRACKER_ICON_IDS, isCustomTrackerIconId } from '../src/protocol/trackerIcons';

/**
 * The widget draws tracker icons from a font cut out of the app's icon font
 * by `scripts/build-widget-icons.py`; this fails when the picker changes
 * and the script was not run again.
 */
describe('the widget tracker icons', () => {
  const res = path.join(__dirname, '../modules/life-core/android/src/main/res');
  const points = JSON.parse(
    fs.readFileSync(path.join(res, 'raw/life_core_tracker_icons.json'), 'utf8'),
  ) as Record<string, number>;
  const glyphs = glyphMap as Record<string, number>;

  it('holds every picker icon but the two stickmen, at its code point in the font', () => {
    const expected = Object.fromEntries(
      TRACKER_ICON_IDS.filter((id) => !isCustomTrackerIconId(id)).map((id) => [id, glyphs[id]]),
    );
    expect(points).toEqual(expected);
  });

  it('ships the cut font, small', () => {
    const size = fs.statSync(path.join(res, 'font/life_core_tracker_icons.ttf')).size;
    expect(size).toBeGreaterThan(1024);
    expect(size).toBeLessThan(64 * 1024);
  });
});
