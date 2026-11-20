const NO_IDS: ReadonlySet<string> = new Set();

/**
 * A newline-joined id list back as a set. The hooks subscribe to store slices
 * as such strings — a primitive compares by value, so the page re-renders only
 * when membership really changes — and read them back through this.
 */
export function idSet(key: string): ReadonlySet<string> {
  return key.length > 0 ? new Set(key.split('\n')) : NO_IDS;
}
