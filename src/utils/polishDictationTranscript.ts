/**
 * Light, on-device cleanup for dictated note text — no network / LLM.
 * English: drop common fillers; all locales: normalize spacing, soft stutter,
 * capitalize, and ensure sentence-ending punctuation.
 */

/** Standalone vocal fillers (English). */
const FILLER_WORD = /\b(?:um+|uh+|uhm+|erm+|er+|ah+|eh+|hmm+|m+hmm*)\b/gi;

/** Spoken padding phrases — keep this list conservative. */
const FILLER_PHRASES: RegExp[] = [
  /\byou know\b/gi,
  /\by'know\b/gi,
];

/** Ends with sentence punctuation (optional trailing quotes/brackets). */
const ENDS_WITH_SENTENCE_PUNCT = /[.!?…]["')\]]*$/;

/** Short function words STT often doubles ("the the", "and and"). */
const STUTTER_WORD =
  /\b(the|a|an|and|or|to|of|i|it|my|is|in|on)(?:\s+\1\b)+/gi;

function isEnglishLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('en');
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

  if (isEnglishLocale(locale)) {
    for (const pattern of FILLER_PHRASES) {
      out = out.replace(pattern, ' ');
    }
    out = out.replace(FILLER_WORD, ' ');
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
