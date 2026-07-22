/**
 * Light, on-device cleanup for dictated note text — no network / LLM.
 * Targets obvious vocal fillers; keeps meaning-bearing words intact.
 */

/** Standalone vocal fillers (English). */
const FILLER_WORD = /\b(?:um+|uh+|uhm+|erm+|er+|ah+|eh+|hmm+|m+hmm*)\b/gi;

/** Common spoken padding phrases — conservative list only. */
const FILLER_PHRASES: RegExp[] = [
  /\byou know\b/gi,
  /\by'know\b/gi,
];

function isEnglishLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('en');
}

/** Remove fillers and normalize spacing after on-device speech recognition. */
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
  // Collapse stuttered duplicates common in raw STT ("the the", "and and").
  out = out.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
  out = out.trim();

  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}
