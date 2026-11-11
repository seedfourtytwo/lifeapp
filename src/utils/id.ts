/** Local-only IDs — no crypto polyfill required on React Native. */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** 32-bit FNV-1a of `text`, starting from `seed`. */
function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * A UUID-shaped id that is always the same for the same parts: the rows a
 * queued action creates, so applying it a second time inserts nothing. Not
 * a cryptographic hash; it only has to keep one action's few rows apart.
 */
export function derivedId(...parts: string[]): string {
  const text = parts.map((part) => `${part.length}:${part}`).join('|');
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
    .map((seed) => fnv1a(text, seed).toString(16).padStart(8, '0'))
    .join('');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
