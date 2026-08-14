import {
  createProtocolBundle,
  DAILY_JOURNAL_BODY_MAX_LENGTH,
  DailyJournalSchema,
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  joinJournalDayBodies,
  JournalNotebookSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
} from '../src/protocol';
import { normalizeProtocolBundleInput } from '../src/db/normalizeProtocolBundle';

const notebook = JournalNotebookSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440030',
  name: 'Journal',
  color: DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
});

const journal = DailyJournalSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440040',
  notebookId: notebook.id,
  date: '2025-01-02',
  body: 'Quiet morning — kept the phone downstairs.',
  createdAt: '2025-01-02T21:00:00.000Z',
  updatedAt: '2025-01-02T21:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
});

describe('daily journals in protocol bundle', () => {
  it('accepts optional dailyJournals and notebooks in a bundle', () => {
    const bundle = createProtocolBundle({
      elements: [],
      dashboard: [],
      events: [],
      journalNotebooks: [notebook],
      dailyJournals: [journal],
    });

    expect(bundle.dailyJournals).toEqual([journal]);
    expect(bundle.journalNotebooks).toEqual([notebook]);
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
    expect(parseProtocolBundle(legacy).journalNotebooks).toBeUndefined();
  });

  it('joins same-day fragments into one body', () => {
    expect(joinJournalDayBodies(['Morning.', 'Evening.'])).toBe('Morning.\n\nEvening.');
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

  it('merges several journals on the same notebook day into one document', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [],
      dashboard: [],
      events: [],
      journalNotebooks: [notebook],
      dailyJournals: [
        journal,
        {
          ...journal,
          id: '550e8400-e29b-41d4-a716-446655440041',
          body: 'Second journal same day',
          createdAt: '2025-01-02T22:00:00.000Z',
        },
      ],
    });
    const bundle = parseProtocolBundle(normalized);
    expect(bundle.dailyJournals).toHaveLength(1);
    expect(bundle.dailyJournals?.[0]?.body).toContain('Quiet morning');
    expect(bundle.dailyJournals?.[0]?.body).toContain('Second journal same day');
  });

  it('rejects journals that point at an unknown notebook', () => {
    expect(() =>
      createProtocolBundle({
        elements: [],
        dashboard: [],
        events: [],
        journalNotebooks: [notebook],
        dailyJournals: [
          {
            ...journal,
            notebookId: '550e8400-e29b-41d4-a716-446655440099',
          },
        ],
      }),
    ).toThrow(/unknown notebook/);
  });

  it('normalizes legacy one-per-day journals onto a default notebook', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [],
      dashboard: [],
      events: [],
      dailyJournals: [
        {
          id: journal.id,
          date: journal.date,
          body: journal.body,
          updatedAt: journal.updatedAt,
          protocolVersion: PROTOCOL_VERSION,
        },
      ],
    });
    const bundle = parseProtocolBundle(normalized);
    expect(bundle.journalNotebooks).toHaveLength(1);
    expect(bundle.dailyJournals).toHaveLength(1);
    expect(bundle.dailyJournals?.[0]?.notebookId).toBe(bundle.journalNotebooks?.[0]?.id);
    expect(bundle.dailyJournals?.[0]?.createdAt).toBe(journal.updatedAt);
  });
});
