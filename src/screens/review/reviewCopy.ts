import type { ReviewRange, ReviewSummary } from '../../review';

/** A sentence as an i18n key in the `review` namespace, with what it interpolates. */
export interface ReviewCopy {
  key: string;
  params?: Record<string, string | number>;
}

/** A 0–1 rate as a whole percentage. */
export function percentOf(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * The one sentence Review opens on. In order: nothing was planned; all of it
 * was done; otherwise the share done, with the window before when there is
 * something fair to compare with.
 */
export function reviewStatement(summary: ReviewSummary, range: ReviewRange): ReviewCopy {
  const { current, previous, comparison, perfect } = summary;
  if (current.rate === null) return { key: `statement.nothing.${range}` };
  if (perfect) return { key: `statement.perfect.${range}` };

  const percent = percentOf(current.rate);
  if (comparison === 'none' || previous.rate === null) {
    return { key: `statement.plain.${range}`, params: { percent } };
  }
  // The sentence shows whole percentages, so two that round alike are "about
  // the same" whatever the unrounded rates say — never "78%, up from 78%".
  const before = percentOf(previous.rate);
  return {
    key: `statement.${before === percent ? 'same' : comparison}.${range}`,
    params: { percent, previous: before },
  };
}

/** A run of a sentence, and whether it is one of its figures. */
export interface CopyPart {
  text: string;
  strong: boolean;
}

/**
 * Splits translated copy on its `<b>…</b>` marks, so the figure in a sentence
 * can be picked out without the translation knowing about styles.
 */
export function emphasisParts(copy: string): CopyPart[] {
  return copy
    .split(/<b>(.*?)<\/b>/)
    .map((text, index) => ({ text, strong: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
