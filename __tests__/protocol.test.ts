import {
  CounterConfigSchema,
  DEFAULT_COUNTER_CONFIG,
  parseElementDefinition,
  parseProtocolBundle,
  PROTOCOL_VERSION,
} from '../src/protocol';

describe('CounterConfigSchema', () => {
  it('accepts valid counter config', () => {
    const result = CounterConfigSchema.parse(DEFAULT_COUNTER_CONFIG);
    expect(result.unit).toBe('reps');
    expect(result.quickIncrements).toEqual([5, 10]);
  });

  it('rejects empty quickIncrements', () => {
    expect(() =>
      CounterConfigSchema.parse({ unit: 'reps', quickIncrements: [] }),
    ).toThrow();
  });
});

describe('parseElementDefinition', () => {
  it('validates counter element', () => {
    const element = parseElementDefinition({
      id: '550e8400-e29b-41d4-a716-446655440000',
      kind: 'counter',
      name: 'Push-ups',
      category: 'exercise',
      config: DEFAULT_COUNTER_CONFIG,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(element.name).toBe('Push-ups');
    expect(element.kind).toBe('counter');
  });
});

describe('parseProtocolBundle', () => {
  it('validates export bundle shape', () => {
    const bundle = parseProtocolBundle({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [],
      dashboard: [],
      events: [],
    });

    expect(bundle.protocolVersion).toBe(1);
    expect(bundle.events).toEqual([]);
  });
});
