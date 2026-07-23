import { z } from 'zod';

export const CounterConfigSchema = z.object({
  unit: z.string().min(1),
  quickIncrements: z.array(z.number().positive()).min(1),
  allowNegative: z.boolean().optional(),
  /** Optional daily goal for progress styling on the counter card */
  dailyTarget: z.number().int().positive().optional(),
  /** Show target-hit streak under the name (only meaningful with dailyTarget). */
  showStreakOnCard: z.boolean().optional(),
});

export type CounterConfig = z.infer<typeof CounterConfigSchema>;

export const CounterEventMetaSchema = z.object({
  source: z.enum(['quick_button', 'manual', 'manual_set']).optional(),
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
  showStreakOnCard?: boolean;
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

/** Target-hit streak on the card — default on when a daily target exists. */
export function shouldShowCounterStreakOnCard(config: CounterConfig): boolean {
  if (!config.dailyTarget || config.dailyTarget <= 0) return false;
  return config.showStreakOnCard !== false;
}

export function buildCounterConfig(
  existing: Partial<CounterConfig>,
  input: Pick<CounterInput, 'quickIncrements' | 'dailyTarget' | 'showStreakOnCard'>,
): CounterConfig {
  const hasTarget = Boolean(input.dailyTarget && input.dailyTarget > 0);
  return {
    unit: existing.unit ?? DEFAULT_COUNTER_CONFIG.unit,
    quickIncrements: input.quickIncrements,
    ...(existing.allowNegative !== undefined ? { allowNegative: existing.allowNegative } : {}),
    ...(hasTarget ? { dailyTarget: input.dailyTarget } : {}),
    ...(hasTarget
      ? input.showStreakOnCard === false
        ? { showStreakOnCard: false }
        : { showStreakOnCard: true }
      : {}),
  };
}
