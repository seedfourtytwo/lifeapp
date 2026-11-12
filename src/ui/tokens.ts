import type { TextStyle } from 'react-native';

/**
 * Night road, flat: the tokens of the kit in this folder (see
 * `docs/mockups/DECISIONS.md` and `night-road.html`). They stand apart from
 * the Paper themes in `src/theme/`, which keep painting every other screen
 * until the redesign moves each one over.
 *
 * Colour shows up only as a thin line: a ring, a progress line, a dot. No
 * blur, no halo, no shadow standing in for light. Every text colour here
 * clears 4.5:1 on every ground here (`themeContrast.test.ts`), so text is
 * dimmed by picking `creamDim`, never by opacity.
 */
export const nightColors = {
  /** The night behind everything, top of the sky down to the horizon. */
  sky: ['#0A0A22', '#15153C', '#26245E', '#3E3280'],
  /** Below the horizon. */
  ground: '#0B0A1E',
  /** A glass surface, lit corner to dark corner. */
  glassTop: '#1A2030',
  glassMiddle: '#0E131D',
  glassBottom: '#070A10',
  /** The 1dp edge along a glass surface's top. */
  glassEdge: '#3B4150',
  /** The edge of a quiet control: there, not lit. */
  quietEdge: '#343A4A',
  /** Text and marks. */
  cream: '#EFE9DC',
  /** Text that steps back: captions, quiet actions. A colour, not a fade. */
  creamDim: '#B5B0A6',
  /** Yours: commitments. */
  violet: '#8B7CFF',
  /** Practice: body, breath; a running timer. */
  teal: '#4FD6C6',
  /** Upkeep, and urges. */
  amber: '#F2B35B',
  /** A milestone at the roadside. */
  lamp: '#FFE7B3',
  /** You, on the road. */
  tail: '#FF4A3D',
  asphalt: '#262757',
  lampPost: '#3A4459',
} as const;

/** The three lights: one lit feature per surface, the colour saying what kind of thing it is. */
export type NightLight = 'violet' | 'teal' | 'amber';

/** A lit ring or line: thin enough to read as drawn, never as glow. */
export const LIT_STROKE = 1.5;
/** A quiet control's edge, and the glass's top edge. */
export const QUIET_STROKE = 1;

export const nightRadius = {
  /** A glass surface. */
  surface: 26,
  /** A field inside a surface. */
  field: 14,
} as const;

/** The smallest a control may be to touch. */
export const TOUCH_MIN = 48;

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
  /** What a thing is called; what a button says. */
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  /** His own words: light, a size up from everything around them. */
  ownWords: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '300',
  },
  /** Words that stand alone: an end state, a question. */
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  /** A caption over or under a number. */
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
} satisfies Record<string, TextStyle>;
