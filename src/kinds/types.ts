import type { GestureResponderEvent } from 'react-native';
import type { ActiveTimerSession, ElementDefinition } from '../protocol';

export interface WidgetProps<TElement extends ElementDefinition = ElementDefinition> {
  element: TElement;
  todayTotal: number;
  onLog?: (value: number, meta?: Record<string, unknown>) => Promise<void>;
  onSetDailyTotal?: (total: number) => Promise<void>;
  onOpenDetails?: () => void;
  /** One-tap dictate: open today's note and start the mic. */
  onDictateNote?: () => void;
  /** Long-press: open today's note for edit without dictating. */
  onEditNote?: () => void;
  hasTodayNote?: boolean;
  isDone?: boolean;
  onToggle?: () => Promise<void>;
  streak?: number;
  failureStreak?: number;
  activeTimerSession?: ActiveTimerSession | null;
  onTimerPress?: () => void | Promise<void>;
  onTimerFinish?: () => void | Promise<void>;
  onResetToday?: () => void | Promise<void>;
  /** Long-press title to drag-reorder on Home (Habits / Counters). */
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
}
