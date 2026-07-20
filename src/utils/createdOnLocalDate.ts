import { toDateString } from '../protocol';

/** Local calendar day for an ISO createdAt — not UTC slice (avoids timezone streak bugs). */
export function createdOnLocalDate(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateString(parsed);
}
