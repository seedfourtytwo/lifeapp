import {
  createProtocolBundle,
  DAILY_JOURNAL_BODY_MAX_LENGTH,
  DailyJournalSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
} from '../src/protocol';

const journal = DailyJournalSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440040',
  date: '2025-01-02',
  body: 'Quiet morning — kept the phone downstairs.',
  updatedAt: '2025-01-02T21:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
});

describe('daily journals in protocol bundle', () => {
  it('accepts optional dailyJournals in a bundle', () => {
    const bundle = createProtocolBundle({
      elements: [],
      dashboard: [],
      events: [],
      dailyJournals: [journal],
    });

    expect(bundle.dailyJournals).toEqual([journal]);
    expect(parseProtocolBundle(bundle)).toEqual(bundle);
  });

  it('omits dailyJournals when empty', () => {
    const bundle = createProtocolBundle({
      elements: [],
      dashboard: [],
      events: [],
      dailyJournals: [],
    });

    expect(bundle.dailyJournals).toBeUndefined();
  });

  it('parses older bundles without dailyJournals', () => {
    const legacy = {
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [],
      dashboard: [],
      events: [],
    };

    expect(parseProtocolBundle(legacy).dailyJournals).toBeUndefined();
  });

  it('rejects empty journal bodies', () => {
    expect(() =>
      DailyJournalSchema.parse({
        ...journal,
        body: '',
      }),
    ).toThrow();
  });

  it('rejects whitespace-only journal bodies', () => {
    expect(() =>
      DailyJournalSchema.parse({
        ...journal,
        body: '   \n\t  ',
      }),
    ).toThrow(/whitespace/i);
  });

  it('rejects bodies over the max length', () => {
    expect(() =>
      DailyJournalSchema.parse({
        ...journal,
        body: 'x'.repeat(DAILY_JOURNAL_BODY_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('rejects duplicate journals for the same day', () => {
    expect(() =>
      createProtocolBundle({
        elements: [],
        dashboard: [],
        events: [],
        dailyJournals: [
          journal,
          {
            ...journal,
            id: '550e8400-e29b-41d4-a716-446655440041',
            body: 'Second journal same day',
          },
        ],
      }),
    ).toThrow(/Duplicate daily journal/);
  });
});
