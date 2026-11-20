/**
 * The Home list and a text field written on it.
 *
 * Edge-to-edge Android does not shrink the window for the keyboard. While a
 * field on the list has focus, the list ends at the keyboard instead of
 * running under it, scrolls the field into the room that is left, and puts the
 * keyboard away when anything else on the list is touched. With no field in
 * focus it does none of this — a keyboard opened by a sheet over the page must
 * not move the page behind it.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { keyboardEventNames } from '../src/hooks/keyboardInset';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeTabScrollView } from '../src/screens/shared/HomeTabScrollView';

type Listener = (event: { endCoordinates: { height: number } }) => void;
type Measure = (
  x: number,
  y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number,
) => void;

const listeners = new Map<string, Listener[]>();
// `measure`, whose page coordinates match the keyboard's; Android's
// `measureInWindow` is a status bar short under edge-to-edge.
const measure = View.prototype.measure as unknown as jest.Mock;
let dismiss: jest.SpyInstance;
let mounted: ReactTestRenderer | null = null;

/** The list's own box in the window: 100 → 800, above a dock. */
const LIST = { x: 0, y: 100, width: 400, height: 700 };
/** The field's line, behind where the keyboard will be. */
const FIELD = { x: 0, y: 700, width: 400, height: 52 };

beforeEach(() => {
  listeners.clear();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: Listener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), cb]);
    return {
      remove: () => listeners.set(name, (listeners.get(name) ?? []).filter((l) => l !== cb)),
    };
  }) as unknown as typeof Keyboard.addListener);
  dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  measure.mockReset();
  jest.restoreAllMocks();
});

async function render(focused: boolean) {
  const fieldRef = React.createRef<View>();
  const element = (hasFocus: boolean) =>
    React.createElement(
      SafeAreaProvider,
      {
        initialMetrics: {
          frame: { x: 0, y: 0, width: 400, height: 900 },
          insets: { top: 24, left: 0, right: 0, bottom: 24 },
        },
      },
      React.createElement(
        HomeTabScrollView,
        { keyboardField: hasFocus ? fieldRef : null },
        React.createElement(View, { ref: fieldRef, testID: 'field' }),
      ),
    );
  // Async, so the reduce-motion read settles inside act.
  await act(async () => {
    mounted = TestRenderer.create(element(focused));
  });
  const tree = mounted as unknown as ReactTestRenderer;
  const root = () => tree.root.findAllByType(View)[0];
  const scroll = () => tree.root.findByType(ScrollView);
  // Every mocked View shares one measure; tell them apart by instance.
  measure.mockImplementation(function (this: unknown, callback: Measure) {
    const box = this === fieldRef.current ? FIELD : LIST;
    callback(0, 0, box.width, box.height, box.x, box.y);
  });
  const layOut = (height: number) =>
    act(() => {
      (scroll().props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height } } });
    });
  layOut(LIST.height);
  return {
    root,
    scroll,
    layOut,
    padding: () => (StyleSheet.flatten(root().props.style) as ViewStyle).paddingBottom,
    showKeyboard: (height: number) =>
      act(() => {
        listeners.get(keyboardEventNames(Platform.OS).show)?.forEach((l) => l({ endCoordinates: { height } }));
      }),
    touch: (pageX: number, pageY: number) =>
      act(() => {
        (root().props.onTouchStart as ((e: unknown) => void) | undefined)?.({
          nativeEvent: { pageX, pageY },
        });
      }),
  };
}

describe('Home list under the keyboard', () => {
  it('ends at the keyboard while a field on it has focus', async () => {
    const list = await render(true);
    expect(list.padding()).toBe(0);
    // 900 window − 24 navigation bar − 300 keyboard = 576; the list ran to 800.
    list.showKeyboard(300);
    expect(list.padding()).toBe(224);
  });

  it('scrolls the covered field up over the keyboard once it has its new height', async () => {
    const list = await render(true);
    const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock;
    scrollTo.mockClear();
    list.showKeyboard(300);
    expect(scrollTo).not.toHaveBeenCalled();
    list.layOut(LIST.height - 224);
    // Field bottom 752 + a row of room 72 − keyboard top 576.
    expect(scrollTo).toHaveBeenCalledWith({ y: 248, animated: true });
  });

  it('brings the field back up when a row filed from it pushes it down', async () => {
    const list = await render(true);
    const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock;
    list.showKeyboard(300);
    list.layOut(LIST.height - 224);
    scrollTo.mockClear();
    act(() => {
      (list.scroll().props.onContentSizeChange as (w: number, h: number) => void)(400, 1280);
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 248, animated: true });
  });

  it('does not chase the content while no field has focus', async () => {
    const list = await render(false);
    const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock;
    scrollTo.mockClear();
    act(() => {
      (list.scroll().props.onContentSizeChange as (w: number, h: number) => void)(400, 1280);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('puts the keyboard away when another row is touched, not the field', async () => {
    const list = await render(true);
    list.showKeyboard(300);
    list.touch(200, 720);
    expect(dismiss).not.toHaveBeenCalled();
    list.touch(200, 300);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('stays as it is for a keyboard that belongs to something else', async () => {
    const list = await render(false);
    list.showKeyboard(300);
    expect(list.padding()).toBe(0);
    list.touch(200, 300);
    expect(dismiss).not.toHaveBeenCalled();
  });
});
