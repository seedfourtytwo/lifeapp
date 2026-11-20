/**
 * The confirmation sheet, drawn: what `confirm()` and `notify()` put on screen
 * through the one host at the app root, and that every way out of it answers.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler, Text as RNText } from 'react-native';
import { Button, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { ConfirmHost, confirm, notify } from '../src/components/sheet';
import { appLightTheme } from '../src/theme/themes';

let backHandlers: (() => boolean)[] = [];
let tree: ReactTestRenderer;

beforeEach(() => {
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
    _name: string,
    cb: () => boolean,
  ) => {
    backHandlers.push(cb);
    return { remove: () => (backHandlers = backHandlers.filter((h) => h !== cb)) };
  }) as unknown as typeof BackHandler.addEventListener);

  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 412, height: 892 },
            insets: { top: 24, left: 0, right: 0, bottom: 24 },
          },
        },
        React.createElement(PaperProvider, {
          theme: appLightTheme,
          children: React.createElement(ConfirmHost),
        }),
      ),
    );
  });
});

afterEach(() => {
  act(() => tree.unmount());
  jest.restoreAllMocks();
});

const strings = () => tree.root.findAllByType(RNText).flatMap((n) => n.props.children);
const buttons = () => tree.root.findAllByType(Button);
const press = (index: number) => act(() => (buttons()[index].props.onPress as () => void)());

function ask(options: Parameters<typeof confirm>[0]): Promise<boolean> {
  let answer!: Promise<boolean>;
  act(() => {
    answer = confirm(options);
  });
  return answer;
}

const DELETE = {
  title: 'Delete habit?',
  message: 'Water and its history are removed.',
  confirmLabel: 'Delete',
  destructive: true,
};

describe('confirm sheet', () => {
  it('draws nothing until something is asked', () => {
    expect(buttons()).toHaveLength(0);
  });

  it('shows the question, a sentence, a quiet Cancel and the action', async () => {
    const answer = ask(DELETE);
    expect(strings()).toEqual(
      expect.arrayContaining(['Delete habit?', 'Water and its history are removed.']),
    );
    expect(buttons().map((b) => b.props.children)).toEqual(['Cancel', 'Delete']);
    expect(buttons()[0].props.mode).toBe('text');
    press(1);
    await expect(answer).resolves.toBe(true);
  });

  it('paints a destructive action in the error colour with its on-colour label', async () => {
    const answer = ask(DELETE);
    const primary = buttons()[1];
    expect(primary.props.buttonColor).toBe(appLightTheme.colors.error);
    expect(primary.props.textColor).toBe(appLightTheme.colors.onError);
    press(0);
    await expect(answer).resolves.toBe(false);
  });

  it('leaves an ordinary action in the theme colour', async () => {
    const answer = ask({ title: 'Start a food journal?', confirmLabel: 'Start' });
    expect(buttons()[1].props.buttonColor).toBeUndefined();
    press(0);
    await answer;
  });

  it('answers no from the scrim and from Android back', async () => {
    const fromScrim = ask(DELETE);
    const [scrim] = tree.root.findAll(
      (n) => n.props.testID === 'confirm-sheet-scrim' && typeof n.props.onPress === 'function',
    );
    act(() => (scrim.props.onPress as () => void)());
    await expect(fromScrim).resolves.toBe(false);

    const fromBack = ask(DELETE);
    act(() => {
      backHandlers.at(-1)?.();
    });
    await expect(fromBack).resolves.toBe(false);
  });

  it('uses the cancel label it is given', async () => {
    const answer = ask({ ...DELETE, cancelLabel: 'Keep it' });
    expect(buttons()[0].props.children).toBe('Keep it');
    press(0);
    await answer;
  });

  it('shows a notice with a single OK', async () => {
    let seen!: Promise<void>;
    act(() => {
      seen = notify({ title: 'Backup saved', message: 'In your downloads.' });
    });
    expect(strings()).toEqual(expect.arrayContaining(['Backup saved', 'In your downloads.']));
    expect(buttons().map((b) => b.props.children)).toEqual(['OK']);
    press(0);
    await expect(seen).resolves.toBeUndefined();
  });
});
