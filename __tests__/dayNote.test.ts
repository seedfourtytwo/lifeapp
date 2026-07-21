import {
  createProtocolBundle,
  DayNoteSchema,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  validateBundleDayNoteLinks,
} from '../src/protocol';
import { appendTranscript } from '../src/utils/appendTranscript';
import {
  normalizeSpeechLocaleTag,
  speechRecognitionLocale,
} from '../src/utils/speechRecognitionLocale';
import { truncateNotePreview } from '../src/utils/trackerHistoryFormat';

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

const dayNote = DayNoteSchema.parse({
  id: '550e8400-e29b-41d4-a716-446655440030',
  elementId: habitElement.id,
  date: '2025-01-02',
  body: 'Felt focused after coffee',
  updatedAt: '2025-01-02T18:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
});

describe('day notes in protocol bundle', () => {
  it('accepts optional dayNotes in a bundle', () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
      dayNotes: [dayNote],
    });

    expect(bundle.dayNotes).toEqual([dayNote]);
    expect(parseProtocolBundle(bundle)).toEqual(bundle);
  });

  it('omits dayNotes when empty', () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
      dayNotes: [],
    });

    expect(bundle.dayNotes).toBeUndefined();
  });

  it('parses older bundles without dayNotes', () => {
    const legacy = {
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [habitElement],
      dashboard: [],
      events: [],
    };

    expect(parseProtocolBundle(legacy).dayNotes).toBeUndefined();
  });

  it('rejects day notes that reference missing elements', () => {
    expect(() =>
      createProtocolBundle({
        elements: [],
        dashboard: [],
        events: [],
        dayNotes: [dayNote],
      }),
    ).toThrow(/unknown element/);
  });

  it('rejects empty note bodies', () => {
    expect(() =>
      DayNoteSchema.parse({
        ...dayNote,
        body: '',
      }),
    ).toThrow();
  });

  it('rejects whitespace-only note bodies', () => {
    expect(() =>
      DayNoteSchema.parse({
        ...dayNote,
        body: '   \n\t  ',
      }),
    ).toThrow(/whitespace/i);
  });

  it('rejects duplicate notes for the same element and day', () => {
    expect(() =>
      createProtocolBundle({
        elements: [habitElement],
        dashboard: [],
        events: [],
        dayNotes: [
          dayNote,
          {
            ...dayNote,
            id: '550e8400-e29b-41d4-a716-446655440031',
            body: 'Second note same day',
          },
        ],
      }),
    ).toThrow(/Duplicate day note/);
  });

  it('rejects bodies over the max length', () => {
    expect(() =>
      DayNoteSchema.parse({
        ...dayNote,
        body: 'x'.repeat(4001),
      }),
    ).toThrow();
  });

  it('validateBundleDayNoteLinks checks element ids', () => {
    expect(() => validateBundleDayNoteLinks([habitElement], [dayNote])).not.toThrow();
    expect(() => validateBundleDayNoteLinks([], [dayNote])).toThrow(/unknown element/);
  });
});

describe('appendTranscript', () => {
  it('joins phrases with a single space', () => {
    expect(appendTranscript('Hello', 'world')).toEqual({
      text: 'Hello world',
      truncated: false,
    });
    expect(appendTranscript('Hello ', 'world')).toEqual({
      text: 'Hello world',
      truncated: false,
    });
    expect(appendTranscript('', '  hi  ')).toEqual({
      text: 'hi',
      truncated: false,
    });
  });

  it('leaves body unchanged for empty transcript', () => {
    expect(appendTranscript('keep', '   ')).toEqual({
      text: 'keep',
      truncated: false,
    });
  });

  it('respects the max body length and reports truncation', () => {
    const almostFull = 'x'.repeat(3990);
    const result = appendTranscript(almostFull, 'more text here');
    expect(result.text.length).toBe(4000);
    expect(result.truncated).toBe(true);
  });
});

describe('truncateNotePreview', () => {
  it('truncates long notes with an ellipsis', () => {
    expect(truncateNotePreview('short')).toBe('short');
    expect(truncateNotePreview('x'.repeat(60)).endsWith('…')).toBe(true);
  });
});

describe('speechRecognitionLocale', () => {
  it('returns a non-empty locale tag', () => {
    expect(speechRecognitionLocale().length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes underscore and bare language tags', () => {
    expect(normalizeSpeechLocaleTag('en_GB')).toBe('en-GB');
    expect(normalizeSpeechLocaleTag('en')).toBe('en-US');
    expect(normalizeSpeechLocaleTag('fr')).toBe('fr-FR');
  });
});
