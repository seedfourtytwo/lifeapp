import { z } from 'zod';

export const CounterConfigSchema = z.object({
  unit: z.string().min(1),
  quickIncrements: z.array(z.number().positive()).min(1),
  allowNegative: z.boolean().optional(),
  /** Optional daily goal for progress styling on the counter card */
  dailyTarget: z.number().int().positive().optional(),
});

export type CounterConfig = z.infer<typeof CounterConfigSchema>;

export const CounterEventMetaSchema = z.object({
  source: z.enum(['quick_button', 'manual']).optional(),
  increment: z.number().optional(),
});

export type CounterEventMeta = z.infer<typeof CounterEventMetaSchema>;

export const DEFAULT_COUNTER_CONFIG: CounterConfig = {
  unit: 'reps',
  quickIncrements: [5, 10],
};

export type CounterInput = {
  name: string;
  quickIncrements: number[];
  dailyTarget?: number;
};

export function formatCounterUnit(count: number, unit: string): string {
  let formatted = unit;
  if (count === 1 && unit.endsWith('s')) {
    formatted = unit.slice(0, -1);
  }
  if (count === 1) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  return formatted;
}

export function buildCounterConfig(
  existing: Partial<CounterConfig>,
  input: Pick<CounterInput, 'quickIncrements' | 'dailyTarget'>,
): CounterConfig {
  return {
    unit: existing.unit ?? DEFAULT_COUNTER_CONFIG.unit,
    quickIncrements: input.quickIncrements,
    ...(existing.allowNegative !== undefined ? { allowNegative: existing.allowNegative } : {}),
    ...(input.dailyTarget && input.dailyTarget > 0 ? { dailyTarget: input.dailyTarget } : {}),
  };
}
