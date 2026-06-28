import type { CounterConfig } from '../protocol';
import { CounterConfigSchema, DEFAULT_COUNTER_CONFIG } from '../protocol';
import type { KindHandler, RegisteredKindHandler } from './types';
import { CounterWidget } from './counter/CounterWidget';

function sumValues(events: { value: number }[]): number {
  return events.reduce((sum, e) => sum + e.value, 0);
}

export const counterHandler: KindHandler<CounterConfig> = {
  kind: 'counter',
  defaultConfig: DEFAULT_COUNTER_CONFIG,
  aggregateDaily: sumValues,
  DashboardWidget: CounterWidget,
};

const handlers = new Map<string, RegisteredKindHandler>([
  [
    'counter',
    {
      kind: 'counter',
      defaultConfig: DEFAULT_COUNTER_CONFIG as Record<string, unknown>,
      aggregateDaily: sumValues,
      DashboardWidget: CounterWidget as RegisteredKindHandler['DashboardWidget'],
    },
  ],
]);

export function getKindHandler(kind: string): RegisteredKindHandler | undefined {
  return handlers.get(kind);
}

export function getAllKindHandlers(): RegisteredKindHandler[] {
  return Array.from(handlers.values());
}

export function validateKindConfig(kind: string, config: unknown): Record<string, unknown> {
  if (kind === 'counter') {
    return CounterConfigSchema.parse(config) as Record<string, unknown>;
  }
  throw new Error(`Unknown element kind: ${kind}`);
}
