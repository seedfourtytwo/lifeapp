import {
  createProtocolBundle,
  CounterConfigSchema,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  validateBundleEventLinks,
  chartPlotValue,
  chartUnitLabel,
  getDailyValueSemantics,
} from '../src/protocol';

describe('Life Protocol bundle', () => {
  const habitElement = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    kind: 'habit' as const,
    name: 'Meditate',
    config: HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'timer',
      dailyTargetSeconds: 900,
    }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  it('validates a complete export bundle', () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          elementId: habitElement.id,
          timestamp: '2025-01-02T10:00:00.000Z',
          date: '2025-01-02',
          value: 900,
          meta: {
            source: 'timer_session',
            startedAt: '2025-01-02T09:45:00.000Z',
            endedAt: '2025-01-02T10:00:00.000Z',
            durationSeconds: 900,
          },
          protocolVersion: PROTOCOL_VERSION,
        },
      ],
    });

    expect(bundle.protocolVersion).toBe(1);
    expect(parseProtocolBundle(bundle)).toEqual(bundle);
  });

  it('rejects events that reference missing elements', () => {
    expect(() =>
      createProtocolBundle({
        elements: [],
        dashboard: [],
        events: [
          {
            id: '550e8400-e29b-41d4-a716-446655440012',
            elementId: habitElement.id,
            timestamp: '2025-01-02T10:00:00.000Z',
            date: '2025-01-02',
            value: 1,
            protocolVersion: PROTOCOL_VERSION,
          },
        ],
      }),
    ).toThrow(/unknown element/);
  });

  /**
   * The editor lets a habit switch between check-off and timer, and its old
   * events stay. A backup must carry that history both ways — an export that
   * throws here leaves the user with no backup at all.
   */
  it('exports and re-imports a habit whose history mixes ticks and timer sessions', () => {
    const switchedHabit = {
      ...habitElement,
      id: '550e8400-e29b-41d4-a716-446655440013',
      config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    };
    const timerSession = {
      id: '550e8400-e29b-41d4-a716-446655440014',
      elementId: switchedHabit.id,
      timestamp: '2025-01-02T10:00:00.000Z',
      date: '2025-01-02',
      value: 60,
      meta: {
        source: 'timer_session',
        startedAt: '2025-01-02T09:59:00.000Z',
        endedAt: '2025-01-02T10:00:00.000Z',
        durationSeconds: 60,
      },
      protocolVersion: PROTOCOL_VERSION,
    };
    const tick = {
      id: '550e8400-e29b-41d4-a716-446655440015',
      elementId: switchedHabit.id,
      timestamp: '2025-01-03T10:00:00.000Z',
      date: '2025-01-03',
      value: 1,
      meta: { source: 'habit_tick' },
      protocolVersion: PROTOCOL_VERSION,
    };
    const timerHabitWithTick = {
      ...habitElement,
      id: '550e8400-e29b-41d4-a716-446655440016',
    };
    const oldTick = { ...tick, id: '550e8400-e29b-41d4-a716-446655440017', elementId: timerHabitWithTick.id };

    const bundle = createProtocolBundle({
      elements: [switchedHabit, timerHabitWithTick],
      dashboard: [],
      events: [timerSession, tick, oldTick],
    });

    expect(bundle.events).toHaveLength(3);
    expect(parseProtocolBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
  });
});

describe('daily value semantics', () => {
  it('describes timer habits in seconds', () => {
    const semantics = getDailyValueSemantics({
      id: '550e8400-e29b-41d4-a716-446655440020',
      kind: 'habit',
      name: 'Meditate',
      config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'timer' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(semantics.unit).toBe('seconds');
  });
});

describe('chart plot value + unit label', () => {
  const counterElement = {
    id: '550e8400-e29b-41d4-a716-446655440030',
    kind: 'counter' as const,
    name: 'Pushups',
    config: CounterConfigSchema.parse({ unit: 'reps', quickIncrements: [1, 5, 10] }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const booleanHabitElement = {
    id: '550e8400-e29b-41d4-a716-446655440031',
    kind: 'habit' as const,
    name: 'Read',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const timerHabitElement = {
    id: '550e8400-e29b-41d4-a716-446655440032',
    kind: 'habit' as const,
    name: 'Meditate',
    config: HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'timer',
      dailyTargetSeconds: 900,
    }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const day = (total: number) => ({ total, trackCompleted: false, markedComplete: false });

  it('plots a counter total as-is, labeled with its configured unit', () => {
    expect(chartPlotValue(counterElement, day(12))).toBe(12);
    expect(chartUnitLabel(counterElement)).toBe('reps');
  });

  it('plots a boolean habit as 0/1, labeled "done"', () => {
    expect(chartPlotValue(booleanHabitElement, day(1))).toBe(1);
    expect(chartPlotValue(booleanHabitElement, day(0))).toBe(0);
    expect(chartUnitLabel(booleanHabitElement)).toBe('done');
  });

  it('plots a timer habit in rounded minutes, labeled "min"', () => {
    expect(chartPlotValue(timerHabitElement, day(90))).toBe(2);
    expect(chartPlotValue(timerHabitElement, day(89))).toBe(1);
    expect(chartUnitLabel(timerHabitElement)).toBe('min');
  });
});

describe('validateBundleEventLinks', () => {
  it('validates linked events in bulk', () => {
    const element = {
      id: '550e8400-e29b-41d4-a716-446655440030',
      kind: 'habit' as const,
      name: 'Read',
      config: HabitConfigSchema.parse({ timeSlot: 'evening', trackingMode: 'boolean' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    expect(() =>
      validateBundleEventLinks([element], [
        {
          id: '550e8400-e29b-41d4-a716-446655440031',
          elementId: element.id,
          timestamp: '2025-01-02T21:00:00.000Z',
          date: '2025-01-02',
          value: 1,
          meta: { source: 'habit_tick' },
          protocolVersion: PROTOCOL_VERSION,
        },
      ]),
    ).not.toThrow();
  });
});
