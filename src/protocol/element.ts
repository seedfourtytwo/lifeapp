import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { CounterConfigSchema } from './kinds/counter';
import { HabitConfigSchema } from './kinds/habit';

/** Only implemented kinds belong here. Add new kinds when you ship them. */
export const ElementKindSchema = z.enum(['counter', 'habit']);

export type ElementKind = z.infer<typeof ElementKindSchema>;

export const ElementCategorySchema = z.enum([
  'exercise',
  'food',
  'habit',
  'task',
  'custom',
]);

export type ElementCategory = z.infer<typeof ElementCategorySchema>;

export const ElementDefinitionSchema = z.object({
  id: z.string().uuid(),
  kind: ElementKindSchema,
  name: z.string().min(1),
  category: ElementCategorySchema,
  parentId: z.string().uuid().nullable().optional(),
  config: z.record(z.unknown()),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  createdAt: z.string().datetime(),
});

export type ElementDefinition = z.infer<typeof ElementDefinitionSchema>;

const configSchemas: Record<ElementKind, z.ZodType> = {
  counter: CounterConfigSchema,
  habit: HabitConfigSchema,
};

export function validateElementConfig(
  kind: ElementKind,
  config: unknown,
): Record<string, unknown> {
  const schema = configSchemas[kind];
  if (!schema) {
    throw new Error(`No config schema for kind: ${kind}`);
  }
  return schema.parse(config) as Record<string, unknown>;
}

export function parseElementDefinition(raw: unknown): ElementDefinition {
  const element = ElementDefinitionSchema.parse(raw);
  validateElementConfig(element.kind, element.config);
  return element;
}
