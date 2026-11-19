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
 * their call sites. Roles without a `fontFamily` are the phone's own face.
 */
export const typeScale = {
  /** The date the Today page is showing. One per screen. */
  dayTitle: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    lineHeight: 40,
  },
  /** A screen or sheet title. */
  screenTitle: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 24,
    lineHeight: 30,
  },
  /**
   * Prose the user wrote, read back on the page: a journal entry. The one
   * place the display face is set at reading size — text meant to be read
   * slowly, with the leading to match.
   */
  reading: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 27,
  },
  /**
   * A page that opens on a sentence instead of a figure: Review's statement.
   * Its figures are picked out in `fontFamily.displayMedium`.
   */
  statement: {
    fontFamily: fontFamily.display,
    fontSize: 27,
    lineHeight: 34,
  },
  /** A habit, counter or settings row's name. */
  rowName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  /** Body copy and what is typed into a field. */
  body: {
    fontSize: 17,
    lineHeight: 24,
  },
  /** The line under a row's name: "4 days in a row". */
  secondary: {
    fontSize: 15,
    lineHeight: 20,
  },
  /** Field labels, group headings, captions. */
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  /**
   * Quiet status under the day title: "2 of 6 done". Words, so the phone's
   * face; mono is kept for numbers that tick.
   */
  meta: {
    fontSize: 14,
    lineHeight: 18,
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
    lineHeight: 20,
  },
  /** The headline figure on a history screen. */
  bigStat: {
    fontFamily: fontFamily.dataMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 26,
    lineHeight: 30,
  },
} satisfies Record<string, TextStyle>;
