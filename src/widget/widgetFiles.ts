import * as FileSystem from 'expo-file-system/legacy';

/**
 * Where the widget files live: `<Context.getFilesDir()>/widget/`, the app's
 * own private storage, which a native module in the same app reads with
 * `File(context.filesDir, "widget/…")`. Null where there is no such
 * directory (web).
 */
export function widgetDirectory(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}widget/` : null;
}

let directoryReady: Promise<void> | null = null;

export function ensureWidgetDirectory(directory: string): Promise<void> {
  if (!directoryReady) {
    directoryReady = FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(
      (error: unknown) => {
        directoryReady = null;
        throw error;
      },
    );
  }
  return directoryReady;
}

/** Remove these files from the widget directory; one already gone is fine. */
export async function deleteWidgetFiles(names: readonly string[]): Promise<void> {
  const directory = widgetDirectory();
  if (!directory) return;
  for (const name of names) {
    await FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true });
  }
}

/**
 * Replace `name` in the widget directory in one step: the text goes to a
 * temporary file first, which is then renamed over the old one. On Android
 * `moveAsync` is `java.io.File.renameTo`, a rename(2) within one directory,
 * so a reader opens either the old file or the new one, never half of either.
 */
export async function replaceWidgetFile(name: string, contents: string): Promise<void> {
  const directory = widgetDirectory();
  if (!directory) return;
  await ensureWidgetDirectory(directory);
  const target = `${directory}${name}`;
  const temporary = `${target}.tmp`;
  await FileSystem.writeAsStringAsync(temporary, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.moveAsync({ from: temporary, to: target });
}
