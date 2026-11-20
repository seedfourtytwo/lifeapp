import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { HabitTrackingMode } from '../protocol';
import type { KindColour } from '../theme/palette';

type GlyphName = keyof typeof MaterialCommunityIcons.glyphMap;

/** What a Today row is, as far as its colour goes. */
export type RowKindSource =
  | { kind: 'habit'; trackingMode: HabitTrackingMode }
  | { kind: 'counter' }
  | { kind: 'todo' };

/**
 * Which of the four kind colours a Today row wears — the same split the
 * lock-screen widget makes: a habit is a timer or a tick by how it is tracked.
 */
export function rowKindColour(row: RowKindSource): KindColour {
  if (row.kind === 'habit') return row.trackingMode === 'timer' ? 'timer' : 'tick';
  return row.kind;
}

/** What a kind's tile draws when the row carries no icon of its own. */
export const ROW_KIND_GLYPHS: Record<KindColour, GlyphName> = {
  timer: 'timer-outline',
  tick: 'white-balance-sunny',
  counter: 'chart-bar',
  todo: 'format-list-bulleted',
};
