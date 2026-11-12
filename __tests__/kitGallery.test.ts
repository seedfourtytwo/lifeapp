/**
 * The kit gallery is how the look gets reviewed on the phone, so it has to
 * show every part the kit has. A part added to `src/ui/` without a place in
 * the gallery fails here.
 */
import React from 'react';
import { readdirSync } from 'fs';
import { join } from 'path';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { KitHost } from '../src/ui/KitHost';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- after the mock above */
const KitGallery = (require('../src/screens/dev/KitGallery') as typeof import('../src/screens/dev/KitGallery')).default;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

/** Files in `src/ui/` that hold no part: tokens, geometry, helpers, the host's own plumbing. */
const NOT_PARTS = new Set([
  'tokens.ts',
  'roadScene.ts',
  'dayMarks.ts',
  'pickerFormat.ts',
  'phonePicker.ts',
  'homeInsets.ts',
  'Overlay.tsx',
  'SheetFrame.tsx',
  'GlassFill.tsx',
  'KitHost.tsx',
]);

/** Parts the gallery shows through a host rather than directly. */
const SHOWN_ON_REQUEST = new Set(['ConfirmSheet']);

let tree: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

/** Mounted, with the icon font's own load settled. */
async function renderGallery(): Promise<ReactTestRenderer> {
  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        { initialMetrics: { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 24 } } },
        React.createElement(KitHost, null, React.createElement(KitGallery)),
      ),
    );
  });
  return tree!;
}

it('shows every part of the kit', async () => {
  const gallery = await renderGallery();
  const parts = readdirSync(join(__dirname, '../src/ui'))
    .filter((file) => !NOT_PARTS.has(file))
    .map((file) => file.replace(/\.tsx?$/, ''));
  expect(parts.length).toBeGreaterThanOrEqual(25);

  const missing = parts.filter((part) => {
    if (SHOWN_ON_REQUEST.has(part)) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each part by its file name
    const module = require(`../src/ui/${part}`) as Record<string, unknown>;
    const component = module[part] as React.ComponentType;
    return gallery.root.findAllByType(component).length === 0;
  });
  expect(missing).toEqual([]);
});

it('goes back from its header', async () => {
  const gallery = await renderGallery();
  const back = gallery.root.findAll((node) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === 'Back')[0]!;
  act(() => (back.props.onPress as () => void)());
  expect(mockGoBack).toHaveBeenCalled();
});
