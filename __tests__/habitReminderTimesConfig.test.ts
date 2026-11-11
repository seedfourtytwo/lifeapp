import {
  buildHabitConfig,
  createProtocolBundle,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
} from '../src/protocol';

describe('habit reminder times', () => {
  it('defaults to no reminder times, so habits saved before them still read', () => {
    const config = HabitConfigSchema.parse({ trackingMode: 'boolean' });

    expect(config.reminderTimes).toEqual([]);
  });

  it('keeps each time once, in clock order', () => {
    const config = HabitConfigSchema.parse({ reminderTimes: ['21:00', '08:30', '21:00', '00:05'] });

    expect(config.reminderTimes).toEqual(['00:05', '08:30', '21:00']);
  });

  it.each(['24:00', '8:30', '12:60', '', 'noon'])('rejects %p as a reminder time', (time) => {
    expect(HabitConfigSchema.safeParse({ reminderTimes: [time] }).success).toBe(false);
  });

  it('stands apart from the time window and its before-start reminder', () => {
    const config = HabitConfigSchema.parse({
      timeRange: { start: '07:00', end: '08:00' },
      remindMinutesBefore: 10,
      reminderTimes: ['19:00'],
    });

    expect(config.remindMinutesBefore).toBe(10);
    expect(config.reminderTimes).toEqual(['19:00']);
  });

  it('is built from editor input for check-off and timer habits alike', () => {
    for (const trackingMode of ['boolean', 'timer'] as const) {
      const config = buildHabitConfig({ trackingMode, reminderTimes: ['18:00', '09:00'] });
      expect(config.reminderTimes).toEqual(['09:00', '18:00']);
    }
    expect(buildHabitConfig({}).reminderTimes).toEqual([]);
  });

  it('survives an export and re-import', () => {
    const element = {
      id: '550e8400-e29b-41d4-a716-446655440801',
      kind: 'habit' as const,
      name: 'Rinse the sprouts',
      config: buildHabitConfig({ trackingMode: 'boolean', reminderTimes: ['08:00', '20:00'] }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2026-11-01T08:00:00.000Z',
    };
    const bundle = createProtocolBundle({ elements: [element], dashboard: [], events: [] });

    const [restored] = parseProtocolBundle(JSON.parse(JSON.stringify(bundle))).elements;

    expect(HabitConfigSchema.parse(restored!.config).reminderTimes).toEqual(['08:00', '20:00']);
  });
});
