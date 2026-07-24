import type { GestureResponderEvent } from 'react-native';
import type { WidgetProps } from './types';

/** Interaction props TrackerCardTitle needs from any Home widget. */
export type TrackerCardTitleInteractionProps = {
  onOpenDetails?: () => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
};

type WidgetInteractionSource = Pick<
  WidgetProps,
  | 'onOpenDetails'
  | 'onLongPressReorder'
  | 'onReorderTouchMove'
  | 'onReorderTouchEnd'
  | 'onReorderTouchCancel'
  | 'delayLongPressReorder'
  | 'reorderHint'
>;

/** Avoid repeating the same 7 prop wires in every kind widget. */
export function trackerCardTitleInteractions(
  source: WidgetInteractionSource,
): TrackerCardTitleInteractionProps {
  return {
    onOpenDetails: source.onOpenDetails,
    onLongPressReorder: source.onLongPressReorder,
    onReorderTouchMove: source.onReorderTouchMove,
    onReorderTouchEnd: source.onReorderTouchEnd,
    onReorderTouchCancel: source.onReorderTouchCancel,
    delayLongPressReorder: source.delayLongPressReorder,
    reorderHint: source.reorderHint,
  };
}
