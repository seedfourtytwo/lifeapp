import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { CounterConfigSchema } from './kinds/counter';
import { HabitConfigSchema } from './kinds/habit';

/** Only implemented kinds belong here. Add new kinds when you ship them. */
export const ElementKindSchema = z.enum(['counter', 'habit']);

export type ElementKind = z.infer<typeof ElementKindSchema>;

const ElementBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  createdAt: z.string().datetime(),
  /** When set, the element is hidden from Home but kept for later restore. */
  archivedAt: z.string().datetime().nullable().optional(),
});

/**
 * A tracker with its config already parsed for its kind, defaults filled in.
 * Parsed once where it enters (a database row, an imported file); everything
 * after that narrows on `kind` and reads `config` as typed.
 */
export const ElementDefinitionSchema = z.discriminatedUnion('kind', [
  ElementBaseSchema.extend({ kind: z.literal('habit'), config: HabitConfigSchema }),
  ElementBaseSchema.extend({ kind: z.literal('counter'), config: CounterConfigSchema }),
]);

export type ElementDefinition = z.infer<typeof ElementDefinitionSchema>;
export type HabitElement = Extract<ElementDefinition, { kind: 'habit' }>;
export type CounterElement = Extract<ElementDefinition, { kind: 'counter' }>;

export function isHabitElement(element: ElementDefinition): element is HabitElement {
  return element.kind === 'habit';
}

export function isCounterElement(element: ElementDefinition): element is CounterElement {
  return element.kind === 'counter';
}

const configSchemas: Record<ElementKind, z.ZodType> = {
  counter: CounterConfigSchema,
  habit: HabitConfigSchema,
};

/** Throws when `config` is not a valid config for `kind`. */
export function assertElementConfig(kind: ElementKind, config: unknown): void {
  configSchemas[kind].parse(config);
}

export function parseElementDefinition(raw: unknown): ElementDefinition {
  const element = ElementDefinitionSchema.parse(raw);
  return { ...element, archivedAt: element.archivedAt ?? null };
}
