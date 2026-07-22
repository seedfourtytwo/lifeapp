import {
  createProtocolBundle,
  DayNoteSchema,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  validateBundleDayNoteLinks,
} from '../src/protocol';
import { appendTranscript, joinDictationParts } from '../src/utils/appendTranscript';
import { polishDictationTranscript } from '../src/utils/polishDictationTranscript';
import {
  localeIsInstalledForOffline,
  normalizeSpeechLocaleTag,
  speechRecognitionLocale,
} from '../src/utils/speechRecognitionLocale';
import {
  bestRecognitionTranscript,
  buildLocalNoteDictationOptions,
} from '../src/utils/speechRecognitionOptions';
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

  it('joins finalized dictation segments', () => {
    expect(joinDictationParts(['Hello', 'world'])).toBe('Hello world');
    expect(joinDictationParts(['  one  ', '', 'two'])).toBe('one two');
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

describe('polishDictationTranscript', () => {
  it('removes common vocal fillers in English', () => {
    expect(polishDictationTranscript('um I went uh to the store you know')).toBe(
      'I went to the store',
    );
  });

  it('keeps meaningful words that resemble fillers', () => {
    expect(polishDictationTranscript('I like this just fine')).toBe(
      'I like this just fine',
    );
  });

  it('skips filler cleanup for non-English locales', () => {
    expect(polishDictationTranscript('um bonjour', 'fr-FR')).toBe('Um bonjour');
  });
  it('collapses simple stutter duplicates', () => {
    expect(polishDictationTranscript('the the cat and and dog')).toBe(
      'The cat and dog',
    );
  });
});

describe('localeIsInstalledForOffline', () => {
  it('matches exact and language-prefix locale tags', () => {
    expect(localeIsInstalledForOffline('en-US', ['en-US'])).toBe(true);
    expect(localeIsInstalledForOffline('en-GB', ['en-US'])).toBe(true);
    expect(localeIsInstalledForOffline('fr-FR', ['en-US'])).toBe(false);
  });
});

describe('bestRecognitionTranscript', () => {
  it('prefers the highest-confidence alternative', () => {
    expect(
      bestRecognitionTranscript([
        { transcript: 'weak', confidence: 0.2 },
        { transcript: 'strong', confidence: 0.9 },
      ]),
    ).toBe('strong');
  });
});

describe('buildLocalNoteDictationOptions', () => {
  it('forces on-device recognition with punctuation and dictation hint', () => {
    const options = buildLocalNoteDictationOptions('en-US');
    expect(options.requiresOnDeviceRecognition).toBe(true);
    expect(options.addsPunctuation).toBe(true);
    expect(options.maxAlternatives).toBe(5);
    expect(options.iosTaskHint).toBe('dictation');
    expect(options.lang).toBe('en-US');
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
