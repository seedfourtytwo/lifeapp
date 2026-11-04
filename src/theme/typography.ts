import type { TextStyle } from 'react-native';

/**
 * Three faces, each with one job.
 *
 * The body face is deliberately absent: Roboto is already on every Android
 * phone, is hinted for small sizes better than anything shipped as an asset,
 * and costs nothing to load. The type budget is spent only where text is read
 * slowly or read as a number.
 *
 *  - `display` — Newsreader, for the one thing a screen is *about*: the day you
 *    are looking at, a screen title. Used large and sparingly; a serif at 11sp
 *    would just be mush.
 *  - `data` — IBM Plex Mono, for anything that is a quantity: streaks, timers,
 *    counts, temperatures, dates in a row. Its figures are the same width, so
 *    a running timer stops jittering and columns line up.
 *  - `meta` — the same mono, small, for the quiet status line under a heading.
 *
 * Nothing here sets `letterSpacing` or `textTransform`. Both were doing the same
 * job — making a line look like a label rather than reading as one — and on a
 * phone held at arm's length they cost more legibility than they buy character.
 * A face is chosen for its own letterforms; respacing it fights that choice.
 * `typographyPlain.test.ts` keeps them out.
 */
export const fontFamily = {
  display: 'Newsreader_400Regular',
  displayMedium: 'Newsreader_500Medium',
  data: 'IBMPlexMono_400Regular',
  dataMedium: 'IBMPlexMono_500Medium',
} as const;

/**
 * The roles these faces play. Sizes are unitless `sp` and scale with the system
 * font — nothing here caps a multiplier; the two places that must are marked at
 * their call sites.
 */
export const typeScale = {
  /** The date a Home tab is showing. One per screen. */
  dayTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
  },
  /** A screen or sheet title where the display face still earns its place. */
  screenTitle: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 20,
    lineHeight: 26,
  },
  /** Quiet status under a title: "0 of 9 done". */
  meta: {
    fontFamily: fontFamily.data,
    fontSize: 12,
    lineHeight: 16,
  },
  /** A number the eye returns to: today's total, a streak, a temperature. */
  data: {
    fontFamily: fontFamily.dataMedium,
    fontVariant: ['tabular-nums'],
  },
  /** A running timer — same face, sized to sit in a tracker row. */
  timer: {
    fontFamily: fontFamily.dataMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
  },
} satisfies Record<string, TextStyle>;
