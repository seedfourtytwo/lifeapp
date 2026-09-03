/**
 * Which chapters of a notebook day a file holds.
 *
 * `chapters` are 1-based day positions, `total` is how many chapters that day
 * has text in. A whole day is left unmarked so its name has not changed.
 */
export type NoteSharePart = {
  chapters: number[];
  total: number;
};

/** Safe `.txt` name for the system share sheet (Proton Drive and similar need a file). */
export function noteShareFileName(opts: {
  kind: 'note' | 'journal';
  label?: string;
  date: string;
  /** 1 or omitted = no suffix; 2+ → `-2`, `-3`. */
  sequence?: number;
  /** Omit for a whole day; set when only some chapters go out. */
  part?: NoteSharePart;
  /**
   * Instant this share file was created. Makes each Share tap unique so
   * destinations that refuse overwrite (Proton Drive) can accept it again.
   */
  sharedAt?: Date;
}): string {
  const stem = fileNameStem(opts.label) || (opts.kind === 'journal' ? 'journal' : 'note');
  const serial =
    opts.sequence != null && opts.sequence > 1 ? `-${opts.sequence}` : '';
  const part = sharePartSegment(opts.part);
  const stamp = opts.sharedAt ? `-${compactShareStamp(opts.sharedAt)}` : '';
  return `${stem}-${opts.date}${serial}${part}${stamp}.txt`;
}

/**
 * How a subset announces itself in the file name.
 *
 * One chapter names itself — `-ch2` — because that is the fact worth filing by.
 * Several become a count, `-ch2of4`: listing every number would run the name
 * long for no gain once the reader has the file open in front of them.
 */
function sharePartSegment(part: NoteSharePart | undefined): string {
  if (!part) return '';
  const picked = part.chapters.length;
  if (picked === 0 || picked >= part.total) return '';
  if (picked === 1) return `-ch${part.chapters[0]}`;
  return `-ch${picked}of${part.total}`;
}

/**
 * Assigns serial suffixes when several files would share the same stem+date.
 * First file keeps the bare name; later ones get `-2`, `-3`, …
 */
export function noteShareFileNames(
  items: { kind: 'note' | 'journal'; label?: string; date: string }[],
): string[] {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const stem = fileNameStem(item.label) || (item.kind === 'journal' ? 'journal' : 'note');
    const key = `${stem}|${item.date}`;
    const sequence = (counts.get(key) ?? 0) + 1;
    counts.set(key, sequence);
    return noteShareFileName({ ...item, sequence });
  });
}

/** Local `HHmmssSSS` — unique per tap without a persisted counter. */
export function compactShareStamp(at: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(at.getHours(), 2)}${pad(at.getMinutes(), 2)}${pad(at.getSeconds(), 2)}${pad(at.getMilliseconds(), 3)}`;
}

export function fileNameStem(label: string | undefined): string {
  const normalized = (label ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return normalized;
}
