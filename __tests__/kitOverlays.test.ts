/**
 * The kit's overlays: a sheet and its ways out, the confirm that replaces
 * the system pop-up for the few things that cannot be undone, and the one
 * undo bar.
 */
import React, { useState } from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, BackHandler, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { ConfirmSheet } from '../src/ui/ConfirmSheet';
import { KitHost, useConfirm, useUndoBar } from '../src/ui/KitHost';
import { Sheet } from '../src/ui/Sheet';
import { nightLayer, nightMotion } from '../src/ui/tokens';

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

/** Host views drawn in this layer. */
function inLayer(root: ReactTestInstance, layer: number): ReactTestInstance[] {
  return root.findAll((node) => typeof node.type === 'string' && flat(node.props.style).zIndex === layer);
}

const METRICS = {
  frame: { x: 0, y: 0, width: 400, height: 900 },
  insets: { top: 24, left: 0, right: 0, bottom: 24 },
};

let tree: ReactTestRenderer | null = null;

/** Mounted, with the reduce-motion query and the icon font settled. */
async function render(element: React.ReactElement): Promise<ReactTestInstance> {
  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(SafeAreaProvider, { initialMetrics: METRICS }, React.createElement(KitHost, null, element)),
    );
  });
  return tree!.root;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  jest.useRealTimers();
});

function texts(root: ReactTestInstance): string[] {
  return root
    .findAll((node) => node.type === 'Text')
    .map((node) => [node.props.children].flat().join(''));
}

function tap(root: ReactTestInstance, label: string) {
  const node = root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)[0];
  if (!node) throw new Error(`Nothing to press said as "${label}"`);
  act(() => (node.props.onPress as () => void)());
}

/** Let the rise or fall run to its end. */
function settle() {
  act(() => {
    jest.runAllTimers();
  });
}

describe('Sheet', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(true);
    return React.createElement(
      Sheet,
      {
        visible: open,
        accessibilityLabel: 'Habit editor',
        onClose: () => {
          onClose();
          setOpen(false);
        },
        children: React.createElement(Text, null, 'Inside the sheet'),
      },
    );
  }

  it('shows what it holds above the screen, in the sheet layer', async () => {
    const root = await render(React.createElement(Harness, { onClose: jest.fn() }));
    expect(texts(root)).toContain('Inside the sheet');
    expect(inLayer(root, nightLayer.sheet).length).toBeGreaterThan(0);
  });

  it('closes from the scrim, and is gone once it has fallen', async () => {
    const onClose = jest.fn();
    const root = await render(React.createElement(Harness, { onClose }));
    tap(root, 'Close');
    expect(onClose).toHaveBeenCalledTimes(1);
    settle();
    expect(texts(root)).not.toContain('Inside the sheet');
  });

  it('closes on Android back, and lets back through once closed', async () => {
    const onClose = jest.fn();
    const listeners: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return { remove: () => listeners.splice(listeners.indexOf(handler as () => boolean), 1) };
    });
    await render(React.createElement(Harness, { onClose }));
    let handled = false;
    act(() => {
      handled = listeners[listeners.length - 1]!();
    });
    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
    spy.mockRestore();
  });

  /** How far a pull must go is `sheetGesture.ts`, tested with the editor sheet; here, only the grabber takes it. */
  it('takes a pull on the grabber only, so the body scrolls freely', async () => {
    const root = await render(React.createElement(Harness, { onClose: jest.fn() }));
    const pulls = root.findAll((node) => typeof node.type === 'string' && typeof node.props.onMoveShouldSetResponder === 'function');
    expect(pulls.map((node) => node.props.testID)).toEqual(['sheet-grabber']);
  });

  it('hides the screen under it from a screen reader while open', async () => {
    const root = await render(React.createElement(Harness, { onClose: jest.fn() }));
    const screens = () =>
      root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityElementsHidden === true && flat(node.props.style).flex === 1);
    expect(screens()).toHaveLength(1);
    expect(screens()[0]!.props.importantForAccessibility).toBe('no-hide-descendants');
    tap(root, 'Close');
    settle();
    expect(screens()).toEqual([]);
  });

  it('needs a KitHost above it, and says so', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      act(() => {
        TestRenderer.create(React.createElement(Sheet, { visible: true, onClose: jest.fn(), accessibilityLabel: 'x', children: null }));
      }),
    ).toThrow('KitHost');
    error.mockRestore();
  });
});

describe('ConfirmSheet and useConfirm', () => {
  let confirm: ReturnType<typeof useConfirm>;
  function Asker() {
    confirm = useConfirm();
    return null;
  }

  it('resolves true only for the action itself', async () => {
    const root = await render(React.createElement(Asker));
    let answer: Promise<boolean>;
    act(() => {
      answer = confirm({ title: 'Erase everything?', line: 'This cannot be undone.', action: 'Erase' });
    });
    expect(texts(root)).toEqual(expect.arrayContaining(['Erase everything?', 'This cannot be undone.', 'Erase', 'Cancel']));
    tap(root, 'Erase');
    await expect(answer!).resolves.toBe(true);
    settle();
    expect(texts(root)).not.toContain('Erase everything?');
  });

  it.each(['Cancel', 'Close'])('resolves false from %s', async (way) => {
    const root = await render(React.createElement(Asker));
    let answer: Promise<boolean>;
    act(() => {
      answer = confirm({ title: 'Delete Water?', action: 'Delete' });
    });
    tap(root, way);
    await expect(answer!).resolves.toBe(false);
  });

  it('asks one thing at a time: a new question answers the old one with no', async () => {
    const root = await render(React.createElement(Asker));
    let first: Promise<boolean>;
    let second: Promise<boolean>;
    act(() => {
      first = confirm({ title: 'Delete Water?', action: 'Delete' });
    });
    act(() => {
      second = confirm({ title: 'Delete Kefir?', action: 'Delete' });
    });
    await expect(first!).resolves.toBe(false);
    expect(texts(root)).toContain('Delete Kefir?');
    expect(texts(root)).not.toContain('Delete Water?');
    tap(root, 'Delete');
    await expect(second!).resolves.toBe(true);
  });

  it('answers no when the host goes away with a question open', async () => {
    await render(React.createElement(Asker));
    let answer: Promise<boolean>;
    act(() => {
      answer = confirm({ title: 'Delete?', action: 'Delete' });
    });
    act(() => tree!.unmount());
    tree = null;
    await expect(answer!).resolves.toBe(false);
  });

  it('draws in the confirm layer, above a sheet', async () => {
    const root = await render(
      React.createElement(ConfirmSheet, {
        visible: true,
        title: 'Delete?',
        action: 'Delete',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
      }),
    );
    expect(inLayer(root, nightLayer.confirm).length).toBeGreaterThan(0);
    expect(nightLayer.confirm).toBeGreaterThan(nightLayer.sheet);
  });
});

describe('the undo bar', () => {
  let bar: ReturnType<typeof useUndoBar>;
  function Shower() {
    bar = useUndoBar();
    return null;
  }

  it('says what happened, offers Undo, and goes once pressed', async () => {
    const onUndo = jest.fn();
    const root = await render(React.createElement(Shower));
    act(() => bar.show({ message: 'Water +2', onUndo }));
    expect(texts(root)).toEqual(expect.arrayContaining(['Water +2', 'Undo']));
    tap(root, 'Undo');
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(texts(root)).not.toContain('Water +2');
  });

  it('leaves by itself after its time, and Undo is not run', async () => {
    const onUndo = jest.fn();
    const root = await render(React.createElement(Shower));
    act(() => bar.show({ message: 'Water +2', onUndo }));
    act(() => {
      jest.advanceTimersByTime(nightMotion.undoMs - 1);
    });
    expect(texts(root)).toContain('Water +2');
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(texts(root)).not.toContain('Water +2');
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('shows one at a time: a new one replaces the old and gets its own full time', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const root = await render(React.createElement(Shower));
    act(() => bar.show({ message: 'Water +2', onUndo: first }));
    act(() => {
      jest.advanceTimersByTime(nightMotion.undoMs - 1000);
    });
    act(() => bar.show({ message: 'Kefir done', onUndo: second }));
    expect(texts(root)).toContain('Kefir done');
    expect(texts(root)).not.toContain('Water +2');
    expect(root.findAll((node) => node.props.testID === 'undo-bar' && typeof node.type === 'string')).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(texts(root)).toContain('Kefir done');
    tap(root, 'Undo');
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('is a plain notice with no action when there is nothing to undo', async () => {
    const root = await render(React.createElement(Shower));
    act(() => bar.show({ message: 'Could not save' }));
    expect(texts(root)).toContain('Could not save');
    expect(texts(root)).not.toContain('Undo');
    act(() => bar.dismiss());
    expect(texts(root)).not.toContain('Could not save');
  });

  it('is said to a screen reader when it appears', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(React.createElement(Shower));
    act(() => bar.show({ message: 'Water +2' }));
    expect(announce).toHaveBeenCalledWith('Water +2');
    announce.mockRestore();
  });
});
