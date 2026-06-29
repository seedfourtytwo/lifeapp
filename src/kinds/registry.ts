import type { CounterConfig } from '../protocol';
import { DEFAULT_COUNTER_CONFIG } from '../protocol';
import type { KindHandler, RegisteredKindHandler } from './types';
import { CounterWidget } from './counter/CounterWidget';
import { habitHandler } from './habit/handler';

function sumValues(events: { value: number }[]): number {
  return events.reduce((sum, e) => sum + e.value, 0);
}

export const counterHandler: KindHandler<CounterConfig> = {
  kind: 'counter',
  defaultConfig: DEFAULT_COUNTER_CONFIG,
  aggregateDaily: sumValues,
  DashboardWidget: CounterWidget,
};

export { habitHandler };

const handlers = new Map<string, RegisteredKindHandler>([
  ['counter', counterHandler as unknown as RegisteredKindHandler],
  ['habit', habitHandler as unknown as RegisteredKindHandler],
]);

export function getKindHandler(kind: string): RegisteredKindHandler | undefined {
  return handlers.get(kind);
}
