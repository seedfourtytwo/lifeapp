/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- the component and its renderer share one fresh React */
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

/**
 * The habit editor's sound preview plays natively; when the track ends by
 * itself the button reads "Preview sound" again.
 */

let React: typeof import('react');
let TestRenderer: typeof import('react-test-renderer');
let mounted: ReactTestRenderer;

async function act(work: () => unknown): Promise<void> {
  await TestRenderer.act(async () => {
    await work();
  });
}

beforeEach(() => {
  jest.resetModules();
  React = require('react');
  TestRenderer = require('react-test-renderer');
});

afterEach(async () => {
  await act(() => mounted.unmount());
});

function buttonText(root: ReactTestInstance): string[] {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
    .map((n) => n.props.children as string);
}

it('turns back to Preview when the track ends', async () => {
  const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');
  jest.spyOn(lifeCore, 'previewSound').mockResolvedValue(true);
  let ended: () => void = () => undefined;
  jest.spyOn(lifeCore, 'addPreviewEndListener').mockImplementation((listener) => {
    ended = listener;
    return { remove: jest.fn() };
  });
  const { PaperProvider } = require('react-native-paper');
  const { appLightTheme } = require('../src/theme/themes');
  const Fields = require('../src/components/trackerEditor/HabitSoundEditorFields').default;
  await act(() => {
    mounted = TestRenderer.create(
      React.createElement(
        PaperProvider,
        { theme: appLightTheme },
        React.createElement(Fields, {
          dailyGoalMinutes: '15',
          sound: { habitSoundTrackId: 'meditation15min', habitSoundPlaybackMode: 'play_once' },
          onDailyGoalMinutesChange: jest.fn(),
          onSoundChange: jest.fn(),
        }),
      ),
    );
  });
  const preview = mounted.root.find(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.findAll((c) => c.props.children === 'Preview sound').length > 0,
  );

  await act(() => (preview.props.onPress as () => void)());
  expect(buttonText(mounted.root)).toContain('Stop preview');

  await act(() => ended());
  expect(buttonText(mounted.root)).toContain('Preview sound');
});
