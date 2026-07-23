import {
  createProtocolBundle,
  DayNoteSchema,
  DAY_NOTE_BODY_MAX_LENGTH,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
  validateBundleDayNoteLinks,
} from '../src/protocol';
import { applyAppLanguage } from '../src/i18n';
import { appendTranscript, joinDictationParts } from '../src/utils/appendTranscript';
import { polishDictationTranscript } from '../src/utils/polishDictationTranscript';
import {
  localeIsInstalledForOffline,
  normalizeSpeechLocaleTag,
  pickInstalledSpeechLocale,
  speechRecognitionLocale,
} from '../src/utils/speechRecognitionLocale';
import {
  bestRecognitionTranscript,
  buildLocalNoteDictationOptions,
} from '../src/utils/speechRecognitionOptions';
import {
  ANDROID_ASI_PACKAGE,
  ANDROID_GOOGLE_TTS_PACKAGE,
  androidPackageUsesAsiOfflineApis,
  pickAndroidRecognitionPackage,
} from '../src/utils/speechRecognitionAndroid';
import {
  messageForSpeechRecognitionError,
  SPEECH_MSG,
} from '../src/utils/speechRecognitionErrors';
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
        body: 'x'.repeat(DAY_NOTE_BODY_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('validateBundleDayNoteLinks checks element ids', () => {
    expect(() => validateBundleDayNoteLinks([habitElement], [dayNote])).not.toThrow();
    expect(() => validateBundleDayNoteLinks([], [dayNote])).toThrow(/unknown element/);
  });
});

describe('appendTranscript', () => {
  it('joins phrases as new paragraphs and leaves a trailing newline', () => {
    expect(appendTranscript('Hello', 'world')).toEqual({
      text: 'Hello\nworld\n',
      truncated: false,
    });
    expect(appendTranscript('Hello\n', 'world')).toEqual({
      text: 'Hello\nworld\n',
      truncated: false,
    });
    expect(appendTranscript('', '  hi  ')).toEqual({
      text: 'hi\n',
      truncated: false,
    });
  });

  it('stacks successive dictation takes as separate lines', () => {
    const first = appendTranscript('', 'Felt calm today.');
    const second = appendTranscript(first.text, 'Had coffee with Sam.');
    expect(second).toEqual({
      text: 'Felt calm today.\nHad coffee with Sam.\n',
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
    const result = appendTranscript(almostFull, 'more text here', 4000);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(4000);
  });

  it('prefers truncating at a word boundary when over the limit', () => {
    const prefix = 'word '.repeat(798); // 3990 chars
    const result = appendTranscript(
      prefix,
      'overflowing leftover words forever and ever',
      4000,
    );
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(4000);
    expect(result.text.endsWith(' ')).toBe(false);
    expect(result.text.includes('overflowing leftover words forever and ever')).toBe(false);
  });

  it('uses the absolute default max when none is passed', () => {
    const almostFull = 'x'.repeat(DAY_NOTE_BODY_MAX_LENGTH - 5);
    const result = appendTranscript(almostFull, 'more text here');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(DAY_NOTE_BODY_MAX_LENGTH);
  });
});

describe('polishDictationTranscript', () => {
  it('removes common vocal fillers in English', () => {
    expect(polishDictationTranscript('um I went uh to the store you know')).toBe(
      'I went to the store.',
    );
  });

  it('keeps meaningful words that resemble fillers', () => {
    expect(polishDictationTranscript('I like this just fine')).toBe(
      'I like this just fine.',
    );
  });

  it('adds a period when the speech has no ending punctuation', () => {
    expect(polishDictationTranscript('felt calm today')).toBe('Felt calm today.');
  });

  it('keeps existing sentence-ending punctuation', () => {
    expect(polishDictationTranscript('Really?')).toBe('Really?');
    expect(polishDictationTranscript('Done!')).toBe('Done!');
    expect(polishDictationTranscript('All set.')).toBe('All set.');
  });

  it('skips filler cleanup for non-English locales', () => {
    expect(polishDictationTranscript('um bonjour', 'fr-FR')).toBe('Um bonjour.');
  });
  it('collapses simple stutter duplicates', () => {
    expect(polishDictationTranscript('the the cat and and dog')).toBe(
      'The cat and dog.',
    );
  });

  it('keeps meaningful repeated words like had had', () => {
    expect(polishDictationTranscript('I had had enough')).toBe('I had had enough.');
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

  it('allows Google TTS path without forcing on-device recognition', () => {
    const options = buildLocalNoteDictationOptions(
      'en-US',
      ANDROID_GOOGLE_TTS_PACKAGE,
      false,
    );
    expect(options.requiresOnDeviceRecognition).toBe(false);
    expect(options.lang).toBe('en-US');
  });
});

describe('pickAndroidRecognitionPackage', () => {
  it('prefers Android System Intelligence when both backends are installed', () => {
    expect(
      pickAndroidRecognitionPackage([ANDROID_GOOGLE_TTS_PACKAGE, ANDROID_ASI_PACKAGE]),
    ).toBe(ANDROID_ASI_PACKAGE);
  });

  it('falls back to Google speech synthesis on GrapheneOS', () => {
    expect(pickAndroidRecognitionPackage([ANDROID_GOOGLE_TTS_PACKAGE])).toBe(
      ANDROID_GOOGLE_TTS_PACKAGE,
    );
  });
});

describe('androidPackageUsesAsiOfflineApis', () => {
  it('is true only for Android System Intelligence', () => {
    expect(androidPackageUsesAsiOfflineApis(ANDROID_ASI_PACKAGE)).toBe(true);
    expect(androidPackageUsesAsiOfflineApis(ANDROID_GOOGLE_TTS_PACKAGE)).toBe(false);
  });
});

describe('messageForSpeechRecognitionError', () => {
  it('ignores benign stop codes', () => {
    expect(messageForSpeechRecognitionError('aborted')).toBeNull();
    expect(messageForSpeechRecognitionError('no-speech')).toBeNull();
  });

  it('guides the user for permission failures', () => {
    expect(messageForSpeechRecognitionError('not-allowed')).toBe(SPEECH_MSG.micLifeApp);
    expect(messageForSpeechRecognitionError('client', 'Insufficient permissions')).toBe(
      SPEECH_MSG.micBoth,
    );
  });

  it('guides install / language / network cases', () => {
    expect(messageForSpeechRecognitionError('service-not-allowed')).toBe(
      SPEECH_MSG.notAvailable,
    );
    expect(messageForSpeechRecognitionError('language-not-supported')).toBe(
      SPEECH_MSG.language,
    );
    expect(messageForSpeechRecognitionError('network')).toBe(SPEECH_MSG.network);
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

  it('follows the active app language for dictation', async () => {
    await applyAppLanguage('fr');
    expect(speechRecognitionLocale().toLowerCase().startsWith('fr')).toBe(true);
    await applyAppLanguage('en');
    expect(speechRecognitionLocale().toLowerCase().startsWith('en')).toBe(true);
  });

  it('remaps en-US requests to an installed en-GB pack', () => {
    expect(pickInstalledSpeechLocale('en-US', ['en-GB', 'fr-FR'])).toBe('en-GB');
    expect(localeIsInstalledForOffline('en-US', ['en-GB'])).toBe(true);
  });

  it('prefers an exact candidate when installed', () => {
    expect(pickInstalledSpeechLocale(['en-US', 'en-GB'], ['en-GB', 'fr-FR'])).toBe('en-GB');
    expect(pickInstalledSpeechLocale(['en-US', 'en-GB'], ['en-US', 'en-GB'])).toBe('en-US');
  });
});
