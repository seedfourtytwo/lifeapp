/**
 * Light, on-device cleanup for dictated note text — no network / LLM.
 * Locale-aware fillers; all locales: normalize spacing, soft stutter,
 * capitalize, and ensure sentence-ending punctuation.
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

function languagePrefix(locale: string): string {
  return locale.trim().toLowerCase().split(/[-_]/)[0] ?? '';
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

  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return ensureSentencePunctuation(out);
}
