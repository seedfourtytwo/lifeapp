import {
  CounterConfigSchema,
  HabitConfigSchema,
  PROTOCOL_VERSION,
  type CounterElement,
  type HabitElement,
} from '../../src/protocol';

type Fields = {
  id: string;
  name?: string;
  /** Raw config, parsed here the way `rowToElement` parses a stored one. */
  config?: Record<string, unknown>;
  createdAt?: string;
  archivedAt?: string | null;
};

function base({ id, name, createdAt, archivedAt }: Fields) {
  return {
    id,
    name: name ?? id,
    protocolVersion: PROTOCOL_VERSION,
    createdAt: createdAt ?? '2025-01-01T00:00:00.000Z',
    archivedAt: archivedAt ?? null,
  };
}

export function habitElement(fields: Fields): HabitElement {
  return { ...base(fields), kind: 'habit', config: HabitConfigSchema.parse(fields.config ?? {}) };
}

export function counterElement(fields: Fields): CounterElement {
  return {
    ...base(fields),
    kind: 'counter',
    config: CounterConfigSchema.parse({ unit: 'reps', quickIncrements: [1], ...fields.config }),
  };
}
