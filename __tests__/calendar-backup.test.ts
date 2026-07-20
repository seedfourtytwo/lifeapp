import {
  createProtocolBundle,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  HabitConfigSchema,
} from '../src/protocol';
import { CALENDAR_BACKUP_VERSION } from '../src/calendar/types';

describe('protocol bundle calendar section', () => {
  const habitElement = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    kind: 'habit' as const,
    name: 'Meditate',
    config: HabitConfigSchema.parse({
      timeSlot: 'anytime',
      trackingMode: 'boolean',
    }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  it('accepts older bundles without calendar', () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
    });
    expect(bundle.calendar).toBeUndefined();
    expect(parseProtocolBundle(bundle).calendar).toBeUndefined();
  });

  it('round-trips calendar backup data', () => {
    const calendarId = '550e8400-e29b-41d4-a716-446655440101';
    const eventId = '550e8400-e29b-41d4-a716-446655440102';
    const reminderId = '550e8400-e29b-41d4-a716-446655440103';

    const bundle = createProtocolBundle({
      elements: [],
      dashboard: [],
      events: [],
      calendar: {
        schemaVersion: CALENDAR_BACKUP_VERSION,
        calendars: [
          {
            id: calendarId,
            name: 'Personal',
            color: '#3D7EA6',
            source: 'local',
          },
        ],
        events: [
          {
            id: eventId,
            calendarId,
            uid: `${eventId}@lifeapp.local`,
            title: 'Birthday',
            notes: null,
            eventType: 'birthday',
            allDay: true,
            startAt: '2020-03-15',
            endAt: '2020-03-15',
            timezone: 'Europe/Berlin',
            rrule: 'FREQ=YEARLY',
          },
        ],
        reminders: [
          {
            id: reminderId,
            eventId,
            offsetMinutes: 60 * 24 * 14,
            enabled: true,
          },
        ],
      },
    });

    const parsed = parseProtocolBundle(bundle);
    expect(parsed.calendar?.events[0]?.title).toBe('Birthday');
    expect(parsed.calendar?.reminders).toHaveLength(1);
  });
});
