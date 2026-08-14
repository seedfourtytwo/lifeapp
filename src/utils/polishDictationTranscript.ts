/**
 * Light, on-device cleanup for dictated note text — no network / LLM.
 * Locale-aware fillers; all locales: normalize spacing, soft stutter,
 * LibriSpeech-style ALL CAPS → sentence case, and ending punctuation.
 */

/** Standalone vocal fillers (English). */
const EN_FILLER_WORD = /\b(?:um+|uh+|uhm+|erm+|er+|ah+|eh+|hmm+|m+hmm*)\b/gi;

/** Spoken padding phrases — keep this list conservative. */
const EN_FILLER_PHRASES: RegExp[] = [
  /\byou know\b/gi,
  /\by'know\b/gi,
];

/** Common French hesitation sounds (conservative — avoid real words like « ben »). */
const FR_FILLER_WORD = /\b(?:euh+|heu+|hum+)\b/gi;

/** Ends with sentence punctuation (optional trailing quotes/brackets). */
const ENDS_WITH_SENTENCE_PUNCT = /[.!?…]["')\]]*$/;

/** Short function words STT often doubles ("the the", "and and" / "je je"). */
const STUTTER_WORD =
  /\b(the|a|an|and|or|to|of|i|it|my|is|in|on|je|tu|il|de|le|la|les|et|ou)(?:\s+\1\b)+/gi;

/** Start of string or after sentence punctuation → capitalize next letter. */
const SENTENCE_START_LETTER = /(^|[.!?…]["')\]]*\s+)([a-z])/g;

/** English first-person forms after lowercasing ALL CAPS. */
const EN_FIRST_PERSON = /\bi\b/g;
const EN_FIRST_PERSON_CONTRACTION = /\bi'(m|d|ll|ve|re)\b/gi;

function languagePrefix(locale: string): string {
  return locale.trim().toLowerCase().split(/[-_]/)[0] ?? '';
}

/**
 * True when the model dumped LibriSpeech-style ALL CAPS (ignore short tokens).
 * Mixed / already-cased text is left alone.
 */
export function looksLikeAllCapsDictation(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (letters.length < 3) return false;
  let upper = 0;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) upper += 1;
  }
  return upper / letters.length >= 0.85;
}

/** Convert ALL CAPS STT into readable sentence case (English “I” restored). */
export function normalizeDictationCasing(
  text: string,
  locale = 'en-US',
): string {
  const trimmed = text.trim();
  if (!trimmed || !looksLikeAllCapsDictation(trimmed)) return trimmed;

  let out = trimmed.toLowerCase();
  out = out.replace(SENTENCE_START_LETTER, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });

  if (languagePrefix(locale) === 'en') {
    out = out.replace(EN_FIRST_PERSON, 'I');
    out = out.replace(
      EN_FIRST_PERSON_CONTRACTION,
      (_m, rest: string) => `I'${rest.toLowerCase()}`,
    );
  }

  return out;
}

/** Ensure a dictated chunk reads as a finished sentence. */
export function ensureSentencePunctuation(text: string): string {
  const out = text.trim();
  if (!out) return out;
  if (ENDS_WITH_SENTENCE_PUNCT.test(out)) return out;
  return `${out}.`;
}

/** Polish raw STT text before appending into a note/journal. */
export function polishDictationTranscript(
  text: string,
  locale = 'en-US',
): string {
  let out = text.trim();
  if (!out) return out;

  const lang = languagePrefix(locale);
  if (lang === 'en') {
    for (const pattern of EN_FILLER_PHRASES) {
      out = out.replace(pattern, ' ');
    }
    out = out.replace(EN_FILLER_WORD, ' ');
  } else if (lang === 'fr') {
    out = out.replace(FR_FILLER_WORD, ' ');
  }

  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/\s+([,.!?])/g, '$1');
  out = out.replace(STUTTER_WORD, '$1');
  out = out.trim();
  out = normalizeDictationCasing(out, locale);

  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return ensureSentencePunctuation(out);
}
