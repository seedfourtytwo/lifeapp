import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * The slice of `expo-file-system/legacy` the widget files use, on a real
 * directory: writes land on disk and a move is a real rename, so a test can
 * read what a native reader would.
 */
export interface FakeFileSystem {
  root: string;
  /** The `expo-file-system/legacy` module shape to hand to `jest.mock`. */
  module: Record<string, unknown>;
  pathOf: (uri: string) => string;
  cleanup: () => void;
}

export function createFakeFileSystem(): FakeFileSystem {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeapp-files-'));
  const pathOf = (uri: string) => uri.replace(/^file:\/\//, '');
  const module = {
    documentDirectory: `file://${root}/`,
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
    makeDirectoryAsync: jest.fn(async (uri: string) => {
      fs.mkdirSync(pathOf(uri), { recursive: true });
    }),
    writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
      fs.writeFileSync(pathOf(uri), contents, 'utf8');
    }),
    readAsStringAsync: jest.fn(async (uri: string) => fs.readFileSync(pathOf(uri), 'utf8')),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      fs.renameSync(pathOf(from), pathOf(to));
    }),
    deleteAsync: jest.fn(async (uri: string, options?: { idempotent?: boolean }) => {
      if (!fs.existsSync(pathOf(uri))) {
        if (options?.idempotent) return;
        throw new Error(`No file at ${uri}`);
      }
      fs.rmSync(pathOf(uri), { recursive: true });
    }),
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: fs.existsSync(pathOf(uri)), uri })),
  };
  return {
    root,
    module,
    pathOf,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
