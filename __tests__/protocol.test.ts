import {
  CounterConfigSchema,
  DEFAULT_COUNTER_CONFIG,
  DEFAULT_HABIT_CONFIG,
  HabitConfigSchema,
  HabitEventMetaSchema,
  buildCounterConfig,
  buildHabitConfig,
  isHabitDayComplete,
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
    expect(result.trackingMode).toBe('boolean');
    expect(result.schedule).toEqual({ type: 'daily' });
  });

  it('accepts timer habit with daily target seconds', () => {
    const result = HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'timer',
      dailyTargetSeconds: 900,
      soundId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.trackingMode).toBe('timer');
    expect(result.dailyTargetSeconds).toBe(900);
  });

  it('builds habit config with tracking mode', () => {
    const result = buildHabitConfig({
      timeSlot: 'evening',
      trackingMode: 'timer',
      dailyTargetSeconds: 600,
    });
    expect(result.trackingMode).toBe('timer');
    expect(result.dailyTargetSeconds).toBe(600);
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

  it('builds habit config with schedule and reminder', () => {
    const result = buildHabitConfig({
      timeSlot: 'morning',
      schedule: { type: 'weekdays', days: [1, 3, 5] },
      timeRange: { start: '07:00', end: '08:00' },
      remindMinutesBefore: 10,
    });
    expect(result.schedule).toEqual({ type: 'weekdays', days: [1, 3, 5] });
    expect(result.remindMinutesBefore).toBe(10);
  });
});

describe('HabitEventMetaSchema', () => {
  it('accepts habit tick meta', () => {
    expect(HabitEventMetaSchema.parse({ source: 'habit_tick' })).toEqual({
      source: 'habit_tick',
    });
  });

  it('accepts timer session meta', () => {
    const meta = HabitEventMetaSchema.parse({
      source: 'timer_session',
      startedAt: '2025-01-01T10:00:00.000Z',
      endedAt: '2025-01-01T10:15:00.000Z',
      durationSeconds: 900,
    });
    expect(meta.source).toBe('timer_session');
    if (meta.source === 'timer_session') {
      expect(meta.durationSeconds).toBe(900);
    }
  });
});

describe('isHabitDayComplete', () => {
  it('marks boolean habit complete at one or more', () => {
    const config = HabitConfigSchema.parse({ timeSlot: 'anytime' });
    expect(isHabitDayComplete(1, config)).toBe(true);
    expect(isHabitDayComplete(0, config)).toBe(false);
  });

  it('marks timer habit complete against daily target', () => {
    const config = HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'timer',
      dailyTargetSeconds: 900,
    });
    expect(isHabitDayComplete(900, config)).toBe(true);
    expect(isHabitDayComplete(899, config)).toBe(false);
  });
});

describe('parseElementDefinition', () => {
  it('validates habit element', () => {
    const element = parseElementDefinition({
      id: '550e8400-e29b-41d4-a716-446655440001',
      kind: 'habit',
      name: 'Meditate',
      category: 'habit',
      config: DEFAULT_HABIT_CONFIG,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(element.kind).toBe('habit');
  });

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
