/** Safe `.txt` name for the system share sheet (Proton Drive and similar need a file). */
export function noteShareFileName(opts: {
  kind: 'note' | 'journal';
  label?: string;
  date: string;
}): string {
  const stem =
    opts.kind === 'journal' ? 'journal' : fileNameStem(opts.label) || 'note';
  return `${stem}-${opts.date}.txt`;
}

function fileNameStem(label: string | undefined): string {
  const normalized = (label ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return normalized;
}
