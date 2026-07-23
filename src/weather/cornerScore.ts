import { z } from 'zod';

/** Persisted daily DVD corner tally for the weather bubble. */
export const CornerScoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(0),
});

export type CornerScore = z.infer<typeof CornerScoreSchema>;

/** Count for `today` (ISO date); other days read as zero. */
export function cornerCountForDay(
  stored: CornerScore | null | undefined,
  today: string,
): number {
  if (!stored || stored.date !== today) return 0;
  return stored.count;
}

/** +1 for today, rolling the date if the calendar day changed. */
export function bumpCornerScore(
  stored: CornerScore | null | undefined,
  today: string,
): CornerScore {
  return { date: today, count: cornerCountForDay(stored, today) + 1 };
}
