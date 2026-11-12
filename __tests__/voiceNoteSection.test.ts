/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';

/**
 * The commitment editor's voice note: recorded with expo-audio (faked here
 * as a recorder that writes a file where the real one would), kept in the
 * app's private files beside the widget's, played by the native core.
 */

let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);

const mockRecorder = {
  uri: null as string | null,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => {
    const file = path.join(mockFs.root, 'cache-recording.m4a');
    fs.writeFileSync(file, 'voice');
    mockRecorder.uri = `file://${file}`;
  }),
};
/** Moves the recorder's clock on, as its status updates would. */
let mockSetDuration: (ms: number) => void = () => undefined;
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => {
    const [durationMillis, setDuration] = require('react').useState(0);
    mockSetDuration = setDuration;
    return { durationMillis, isRecording: false };
  },
}));
const mockMic = jest.fn(async () => true);
jest.mock('../src/dictation/requestMicPermission', () => ({
  requestDictationMicPermission: () => mockMic(),
}));

let React: typeof import('react');
let TestRenderer: typeof import('react-test-renderer');
let mounted: ReactTestRenderer;

async function act(work: () => unknown): Promise<void> {
  await TestRenderer.act(async () => {
    await work();
  });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(() => new Promise((resolve) => setImmediate(resolve)));
  }
}

const notePath = () => path.join(mockFs.root, 'widget/voice-note.m4a');

beforeEach(() => {
  jest.resetModules();
  React = require('react');
  TestRenderer = require('react-test-renderer');
  mockFs = createFakeFileSystem();
  mockRecorder.uri = null;
  mockMic.mockResolvedValue(true);
  jest.clearAllMocks();
});

afterEach(async () => {
  await act(() => mounted.unmount());
  mockFs.cleanup();
});

async function render(): Promise<ReactTestInstance> {
  const { PaperProvider } = require('react-native-paper');
  const { appLightTheme } = require('../src/theme/themes');
  const VoiceNoteSection = require('../src/components/trackerEditor/VoiceNoteSection').default;
  await act(() => {
    mounted = TestRenderer.create(
      React.createElement(PaperProvider, { theme: appLightTheme }, React.createElement(VoiceNoteSection)),
    );
  });
  await flush();
  return mounted.root;
}

function texts(root: ReactTestInstance): string[] {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
    .map((n) => n.props.children as string);
}

async function press(root: ReactTestInstance, text: string): Promise<void> {
  const button = root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.findAll((c) => typeof c.type === 'string' && c.props.children === text).length > 0 &&
      n.props.accessibilityRole === 'button',
  );
  await act(() => (button.props.onPress as () => void)());
  await flush();
}

it('records once the microphone is allowed, and keeps the note in the private files', async () => {
  const root = await render();
  expect(texts(root)).toContain('Kept on this phone only: exports leave it out.');

  await press(root, 'Record');
  expect(mockMic).toHaveBeenCalledTimes(1);
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  expect(texts(root)).toContain('Recording 0:00 of 1:00');

  await press(root, 'Stop');
  expect(fs.readFileSync(notePath(), 'utf8')).toBe('voice');
  expect(texts(root)).toEqual(expect.arrayContaining(['Play', 'Record again', 'Delete']));
});

it('stops by itself at a minute', async () => {
  const root = await render();
  await press(root, 'Record');

  await act(() => mockSetDuration(60_000));
  await flush();

  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(notePath())).toBe(true);
  expect(texts(root)).not.toContain('Stop');
});

it('records nothing and says why when the microphone is refused', async () => {
  mockMic.mockResolvedValue(false);
  const root = await render();
  await press(root, 'Record');

  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(texts(root)).toContain('Recording needs the microphone. Allow it for Life in the phone settings.');
});

it('plays the note through the native core', async () => {
  fs.mkdirSync(path.join(mockFs.root, 'widget'));
  fs.writeFileSync(notePath(), 'voice');
  const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');
  const played = jest.spyOn(lifeCore, 'playNote');
  const root = await render();

  await press(root, 'Play');
  expect(played).toHaveBeenCalledTimes(1);
  expect(texts(root)).toContain('Stop');
});

it('deletes the note after a confirm', async () => {
  fs.mkdirSync(path.join(mockFs.root, 'widget'));
  fs.writeFileSync(notePath(), 'voice');
  const { Alert } = require('react-native') as typeof import('react-native');
  const alert = jest.spyOn(Alert, 'alert');
  const root = await render();

  await press(root, 'Delete');
  const buttons = alert.mock.calls[0]![2]!;
  await act(() => buttons.find((b) => b.style === 'destructive')!.onPress!());
  await flush();

  expect(fs.existsSync(notePath())).toBe(false);
  expect(texts(root)).toContain('Record');
});
