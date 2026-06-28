import {
  CounterConfigSchema,
  DEFAULT_COUNTER_CONFIG,
  buildCounterConfig,
  HabitConfigSchema,
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

  it('accepts optional daily target', () => {
    const result = CounterConfigSchema.parse({
      unit: 'reps',
      quickIncrements: [5, 10],
      dailyTarget: 50,
    });
    expect(result.dailyTarget).toBe(50);
  });

  it('builds counter config with optional daily target', () => {
    const result = buildCounterConfig(DEFAULT_COUNTER_CONFIG, {
      quickIncrements: [5, 10],
      dailyTarget: 40,
    });
    expect(result.dailyTarget).toBe(40);
  });

  it('rejects empty quickIncrements', () => {
    expect(() =>
      CounterConfigSchema.parse({ unit: 'reps', quickIncrements: [] }),
    ).toThrow();
  });
});

describe('HabitConfigSchema', () => {
  it('accepts habit with target label and time slot', () => {
    const result = HabitConfigSchema.parse({
      timeSlot: 'morning',
      targetLabel: '15 min',
    });
    expect(result.timeSlot).toBe('morning');
    expect(result.targetLabel).toBe('15 min');
  });

  it('accepts habit with scheduled time range', () => {
    const result = HabitConfigSchema.parse({
      timeSlot: 'morning',
      timeRange: { start: '06:00', end: '09:00' },
      visibleOnlyInTimeRange: true,
    });
    expect(result.timeRange).toEqual({ start: '06:00', end: '09:00' });
    expect(result.visibleOnlyInTimeRange).toBe(true);
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
