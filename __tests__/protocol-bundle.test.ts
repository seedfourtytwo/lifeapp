import {
  createProtocolBundle,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  validateEventForElement,
  validateBundleEventLinks,
  getDailyValueSemantics,
  isElementDayComplete,
} from '../src/protocol';

describe('Life Protocol bundle', () => {
  const habitElement = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    kind: 'habit' as const,
    name: 'Meditate',
    category: 'habit' as const,
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

  it('rejects timer meta on boolean habits', () => {
    const booleanHabit = {
      ...habitElement,
      id: '550e8400-e29b-41d4-a716-446655440013',
      config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    };

    expect(() =>
      validateEventForElement(booleanHabit, {
        id: '550e8400-e29b-41d4-a716-446655440014',
        elementId: booleanHabit.id,
        timestamp: '2025-01-02T10:00:00.000Z',
        date: '2025-01-02',
        value: 60,
        meta: {
          source: 'timer_session',
          startedAt: '2025-01-02T09:45:00.000Z',
          endedAt: '2025-01-02T10:00:00.000Z',
          durationSeconds: 60,
        },
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).toThrow(/timer_session/);
  });
});

describe('daily value semantics', () => {
  it('describes timer habits in seconds', () => {
    const semantics = getDailyValueSemantics({
      id: '550e8400-e29b-41d4-a716-446655440020',
      kind: 'habit',
      name: 'Meditate',
      category: 'habit',
      config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'timer' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(semantics.unit).toBe('seconds');
  });

  it('marks timer habit complete when goal is met', () => {
    const element = {
      id: '550e8400-e29b-41d4-a716-446655440021',
      kind: 'habit' as const,
      name: 'Meditate',
      category: 'habit' as const,
      config: HabitConfigSchema.parse({
        timeSlot: 'anytime',
        trackingMode: 'timer',
        dailyTargetSeconds: 900,
      }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    expect(isElementDayComplete(element, 900)).toBe(true);
    expect(isElementDayComplete(element, 899)).toBe(false);
  });
});

describe('validateBundleEventLinks', () => {
  it('validates linked events in bulk', () => {
    const element = {
      id: '550e8400-e29b-41d4-a716-446655440030',
      kind: 'habit' as const,
      name: 'Read',
      category: 'habit' as const,
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
