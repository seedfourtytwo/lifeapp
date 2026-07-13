import type { CounterConfig } from '../../protocol';
import { DEFAULT_COUNTER_CONFIG } from '../../protocol';
import { sumEventValues } from '../../utils/events';
import type { KindHandler } from '../types';
import { CounterWidget } from './CounterWidget';

export const counterHandler: KindHandler<CounterConfig> = {
  kind: 'counter',
  defaultConfig: DEFAULT_COUNTER_CONFIG,
  aggregateDaily: sumEventValues,
  DashboardWidget: CounterWidget,
};
