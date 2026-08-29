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
 *  - `meta` — the same mono, small and letterspaced, for the quiet status line
 *    under a heading.
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
    letterSpacing: -0.4,
  },
  /** A screen or sheet title where the display face still earns its place. */
  screenTitle: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  /** Quiet uppercase status under a title: "41-DAY STREAK · 22°C". */
  meta: {
    fontFamily: fontFamily.data,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
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
    letterSpacing: -0.2,
  },
} satisfies Record<string, TextStyle>;
