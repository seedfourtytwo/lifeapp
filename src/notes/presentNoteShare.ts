import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { i18n } from '../i18n';

function shareUnavailable(): never {
  throw new Error(i18n.t('note.couldNotShareBody'));
}

/** Opens the system share sheet with a `.txt` file (Android EXTRA_STREAM). */
export async function presentNoteShare(opts: {
  title: string;
  body: string;
  fileName: string;
}): Promise<void> {
  const body = opts.body.trim();
  if (!body) shareUnavailable();
  if (!(await Sharing.isAvailableAsync())) shareUnavailable();

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) shareUnavailable();

  const path = `${directory}${opts.fileName}`;
  await FileSystem.writeAsStringAsync(path, body, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const fileUrl = path.startsWith('file:') ? path : `file://${path}`;
  await Sharing.shareAsync(fileUrl, {
    mimeType: 'text/plain',
    dialogTitle: opts.title,
    UTI: 'public.plain-text',
  });
}
