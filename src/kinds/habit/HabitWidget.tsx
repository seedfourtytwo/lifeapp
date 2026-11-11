import type { HabitElement } from '../../protocol';
import type { WidgetProps } from '../types';
import { HabitBooleanWidget } from './HabitBooleanWidget';
import { HabitTimerWidget } from './HabitTimerWidget';

export function HabitWidget(props: WidgetProps<HabitElement>) {
  if (props.element.config.trackingMode === 'timer') {
    return <HabitTimerWidget {...props} />;
  }
  return <HabitBooleanWidget {...props} />;
}
