/**
 * One spacing scale, so gaps are chosen rather than typed.
 *
 * The codebase already sat mostly on a 4pt grid — 4, 8, 12, 16, 24 and 48
 * accounted for most of it — with 6, 10 and 14 scattered through as one-offs
 * that read as "a bit more than 8". Those in-between values are what make a
 * layout look approximate; naming the steps is what makes it look decided.
 */
export const space = {
  /** Hairline gaps inside a control: icon to its own label. */
  xxs: 2,
  /** Between tightly related items — a fire glyph and its count. */
  xs: 4,
  /** Inside a row: icon to text, chip to chip. */
  sm: 8,
  /** Between rows, and around a card's contents. */
  md: 12,
  /** Screen gutters, and the gap between distinct groups. */
  lg: 16,
  /** Between sections of a screen. */
  xl: 24,
  /** Standing room above an empty state. */
  xxl: 48,
} as const;

export type Space = (typeof space)[keyof typeof space];
