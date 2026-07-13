import type { HabitConfig } from '../../protocol';
import type { WidgetProps } from '../types';
import { HabitBooleanWidget } from './HabitBooleanWidget';
import { HabitTimerWidget } from './HabitTimerWidget';

export function HabitWidget(props: WidgetProps<HabitConfig>) {
  if (props.config.trackingMode === 'timer') {
    return <HabitTimerWidget {...props} />;
  }
  return <HabitBooleanWidget {...props} />;
}
