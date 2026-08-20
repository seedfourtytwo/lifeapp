import type { FoodItem } from '../protocol';
import { foodSearchTerms } from './seedCatalog';

/**
 * Diacritic-insensitive food search. "epinard" must find "Épinard" and "oeuf"
 * must find "Œuf" — typing accents on a phone keyboard is friction we can drop.
 */
export function normalizeFoodQuery(value: string): string {
  return value
    .normalize('NFD')
    // Combining marks — \p{Diacritic} is not safe on every Hermes build.
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .trim();
}

const BEST_RANK = 0;

/**
 * Lower rank sorts first. `null` means no match. `wordStart` is built once per
 * query by the caller — it depends only on the query, and rebuilding it per
 * term per item made every keystroke allocate a regex for the whole catalog.
 */
function matchRank(
  terms: readonly string[],
  query: string,
  wordStart: RegExp,
): number | null {
  let best: number | null = null;
  for (const term of terms) {
    const normalized = normalizeFoodQuery(term);
    if (!normalized) continue;
    let rank: number | null = null;
    if (normalized === query) rank = 0;
    else if (normalized.startsWith(query)) rank = 1;
    else if (wordStart.test(normalized)) rank = 2;
    else if (normalized.includes(query)) rank = 3;
    if (rank != null && (best == null || rank < best)) best = rank;
    // Nothing can beat an exact match, so stop looking at further aliases.
    if (best === BEST_RANK) break;
  }
  return best;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Filter and rank the catalog for a query. An empty query returns everything
 * in the order it came in (the repository already sorts by name).
 */
export function searchFoodItems(items: readonly FoodItem[], query: string): FoodItem[] {
  const normalized = normalizeFoodQuery(query);
  if (!normalized) return [...items];

  const wordStart = new RegExp(`\\b${escapeRegExp(normalized)}`);
  const ranked: { item: FoodItem; rank: number }[] = [];
  for (const item of items) {
    const rank = matchRank(foodSearchTerms(item), normalized, wordStart);
    if (rank != null) ranked.push({ item, rank });
  }
  // Stable within a rank: the incoming name order is preserved by sort stability.
  return ranked.sort((a, b) => a.rank - b.rank).map((entry) => entry.item);
}
