import { z } from 'zod';

export const CounterConfigSchema = z.object({
  unit: z.string().min(1),
  quickIncrements: z.array(z.number().positive()).min(1),
  allowNegative: z.boolean().optional(),
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
