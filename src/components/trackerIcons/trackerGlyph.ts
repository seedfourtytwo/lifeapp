import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CustomTrackerIconId, TrackerIconId } from '../../protocol';

type GlyphName = keyof typeof MaterialCommunityIcons.glyphMap;
type GlyphTrackerIconId = Exclude<TrackerIconId, CustomTrackerIconId>;

/**
 * The catalogue stores the filled glyph name. These are the ids whose font
 * also has an outline twin; a tracker draws the twin, so the rows read as one
 * line-drawn family. Ids without a twin (most sport and object glyphs) are
 * drawn as stored.
 * `__tests__/iconFamily.test.ts` fails if a twin exists and is not listed here.
 */
export const TRACKER_OUTLINE_GLYPHS: Partial<Record<GlyphTrackerIconId, GlyphName>> = {
  'book-open-variant': 'book-open-variant-outline',
  school: 'school-outline',
  timer: 'timer-outline',
  spa: 'spa-outline',
  heart: 'heart-outline',
  'hospital-box': 'hospital-box-outline',
  'arm-flex': 'arm-flex-outline',
  water: 'water-outline',
  coffee: 'coffee-outline',
  'food-apple': 'food-apple-outline',
  food: 'food-outline',
  bed: 'bed-outline',
  'check-circle': 'check-circle-outline',
  home: 'home-outline',
  sofa: 'sofa-outline',
  calendar: 'calendar-outline',
  palette: 'palette-outline',
  camera: 'camera-outline',
  'gamepad-variant': 'gamepad-variant-outline',
  'account-group': 'account-group-outline',
  paw: 'paw-outline',
  car: 'car-outline',
  'map-marker': 'map-marker-outline',
  phone: 'phone-outline',
  'rocket-launch': 'rocket-launch-outline',
};

/** The glyph a tracker icon draws: its outline twin where the font has one. */
export function trackerGlyphName(id: GlyphTrackerIconId): GlyphName {
  return TRACKER_OUTLINE_GLYPHS[id] ?? (id as GlyphName);
}
