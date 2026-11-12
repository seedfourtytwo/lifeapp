import type { TextStyle } from 'react-native';
import { space } from '../theme/spacing';

/**
 * Night road, flat: every token of the kit in this folder (see
 * `docs/mockups/DECISIONS.md`, `night-road.html` and `night-road-app.html`).
 * This file is the kit's one source. The spacing scale is shared with the
 * Paper screens and lives in `src/theme/spacing.ts`; it is re-exported here
 * so a rebuilt screen imports its tokens from one place. The Paper themes in
 * `src/theme/` keep painting every other screen until the redesign moves it.
 *
 * Colour shows up only as a thin line: a ring, a progress line, a dot. No
 * blur, no halo, no shadow standing in for light. Every text colour here
 * clears 4.5:1 on every ground it lands on (`themeContrast.test.ts`), so text
 * is dimmed by picking `creamDim`, never by opacity.
 */
export const nightColors = {
  /** The night behind a full screen, top of the sky down to the horizon. */
  sky: ['#0A0A22', '#15153C', '#26245E', '#3E3280'],
  /** Below the horizon, and the colour behind a screen while it opens. */
  ground: '#0B0A1E',
  /** A glass surface, lit corner to dark corner: tiles, buttons, sheets. */
  glassTop: '#1A2030',
  glassMiddle: '#0E131D',
  glassBottom: '#070A10',
  /** The 1dp edge along a glass surface's top. */
  glassEdge: '#3B4150',
  /** The edge of a quiet control: there, not lit. */
  quietEdge: '#343A4A',
  /** Sunk into the glass: a field, the track of a segmented control. */
  well: '#0A0D15',
  /** The line between two rows of one group. */
  divider: '#232836',
  /** An empty progress line, an off toggle. */
  track: '#30343E',
  /** A day that counted and was missed: a dim dash. */
  missed: '#5A5B61',
  /** A day that does not count (before the tracker, not scheduled): barely there. */
  notCounted: '#262A34',
  /** The grabber on a sheet. */
  grabber: '#4A4E58',
  /** What dims the screen behind a sheet. Decoration, never behind text. */
  scrim: 'rgba(4, 4, 14, 0.62)',
  /** Text and marks. */
  cream: '#EFE9DC',
  /** Text that steps back: captions, labels, quiet actions. A colour, not a fade. */
  creamDim: '#B5B0A6',
  /** Words and marks cut out of cream. */
  ink: '#0A0D14',
  /** Yours: commitments. */
  violet: '#8B7CFF',
  /** Practice: body, breath; a running timer. */
  teal: '#4FD6C6',
  /** Upkeep, and urges. */
  amber: '#F2B35B',
  /** Each light sunk into the glass: the fill of an on toggle. Never behind text. */
  violetTint: '#3A3484',
  tealTint: '#1C5A58',
  amberTint: '#5A4320',
  /** A milestone at the roadside. */
  lamp: '#FFE7B3',
  /** You, on the road. Only ever on the road. */
  tail: '#FF4A3D',
  /** Delete, Erase: a soft coral, so the few things that cannot be undone read as such without alarm. */
  danger: '#F0907F',
  asphalt: '#262757',
  lampPost: '#3A4459',
} as const;

/** The three lights: one lit feature per surface, the colour saying what kind of thing it is. */
export type NightLight = 'violet' | 'teal' | 'amber';

export const NIGHT_LIGHTS: readonly NightLight[] = ['violet', 'teal', 'amber'];

/** Each light's tint. */
export const lightTint: Record<NightLight, string> = {
  violet: nightColors.violetTint,
  teal: nightColors.tealTint,
  amber: nightColors.amberTint,
};

/** What a text or a mark is painted in: cream, dimmed cream, one of the lights, or danger. */
export type NightTone = 'cream' | 'dim' | NightLight | 'danger';

export function toneColor(tone: NightTone): string {
  return tone === 'dim' ? nightColors.creamDim : nightColors[tone];
}

/** Gaps, from the one spacing scale. */
export { space };

/** Line widths. */
export const nightStroke = {
  /** A lit ring or line: thin enough to read as drawn, never as glow. */
  lit: 1.5,
  /** A quiet control's edge, the glass's top edge, a divider. */
  quiet: 1,
  /** A progress line and a day's dash. */
  line: 3,
} as const;

/** Corners, stepping up with the size of what they wrap. */
export const nightRadius = {
  /** The inner part of a control: a segment, an icon's squircle. */
  inner: 13,
  /** A field, a segmented control's track. */
  field: 16,
  /** A tile in a list, a group of rows. */
  tile: 22,
  /** A larger glass surface standing on its own. */
  surface: 26,
  /** A sheet's top corners. */
  sheet: 30,
  /** Fully round ends at any height: pills, chips, dashes. Geometry, not a size. */
  pill: 999,
} as const;

/** The smallest a control may be to touch. */
export const TOUCH_MIN = 48;

/** A round button's diameter, and the icon it holds, by size. */
export const roundSize = {
  /** In a header: back, settings, more. */
  sm: { box: 48, icon: 20 },
  /** On a tile, in the dock. */
  md: { box: 56, icon: 24 },
  /** The one main action of a tile: start the next thing. */
  lg: { box: 72, icon: 28 },
} as const;

export type RoundSize = keyof typeof roundSize;

/** Icon sizes outside a round button. */
export const iconSize = {
  /** Beside a caption, a chevron. */
  sm: 16,
  /** Beside a name; inside a squircle. */
  md: 20,
  /** On its own. */
  lg: 24,
} as const;

export type IconSize = keyof typeof iconSize;

/** The squircle that holds a thing's icon. */
export const MARK_SIZE = 44;

/** A dot that carries a light next to a name. */
export const DOT_SIZE = 8;

/** A toggle's track and knob. */
export const toggleSize = { width: 48, height: 28, knob: 20 } as const;

/** The grabber on top of a sheet. */
export const grabberSize = { width: 36, height: 4 } as const;

/** A day's dash in a week row. */
export const DASH_WIDTH = 16;

/**
 * Stacking of the overlays the kit owns, above every screen. A confirm can
 * be asked from inside a sheet; the undo bar must show over both, since it
 * is what an action in either leaves behind.
 */
export const nightLayer = {
  sheet: 10,
  confirm: 20,
  undo: 30,
} as const;

export type NightLayer = keyof typeof nightLayer;

/** Timings. Under reduced motion every travel is zero; the end state still arrives. */
export const nightMotion = {
  /** A sheet rising. */
  rise: 260,
  /** A sheet or a bar leaving. */
  fall: 180,
  /** A toggle's knob, a bar fading in. */
  quick: 140,
  /** How long the undo bar stays: long enough to notice a slip and reach Undo. */
  undoMs: 5000,
} as const;

/** Whole-control state: a pressed or disabled control fades as a whole, never its text alone. */
export const nightState = {
  pressed: 0.7,
  disabled: 0.4,
} as const;

/**
 * Type roles. The phone's own face (Roboto on Android), the same face and
 * weights the lock-screen widget draws with, so the two read as one object;
 * no font is bundled for them. Sizes are `sp` and scale with the system font.
 */
export const nightType = {
  /** The number a screen is about: a countdown, a clock. Light, large, tabular. */
  number: {
    fontSize: 72,
    lineHeight: 84,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  /** A number inside a surface: a running timer. */
  numberSmall: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  /** A figure among others: a streak, a best, a count. */
  stat: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  /** Where you are: today's date, Journal. The top of one of the three places. */
  place: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '300',
  },
  /** A pushed screen's title, beside its back button. */
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '300',
  },
  /** What a thing is called; what a button says. */
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  /** A plain statement that ends something: "Ridden out." */
  statement: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '300',
  },
  /** His own words standing alone: light, well above everything around them. */
  ownWords: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '300',
  },
  /** His own words inside a tile: a day's note. Light, a size up from body. */
  ownLine: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '300',
  },
  /** Words that stand alone: an end state, a question, a row's label. */
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  /** A caption over or under a name or a number; a section's label. */
  caption: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
} satisfies Record<string, TextStyle>;

export type NightTypeRole = keyof typeof nightType;
