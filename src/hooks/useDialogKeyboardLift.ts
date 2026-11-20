import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { dialogKeyboardLift, keyboardEventNames } from './keyboardInset';

/** The on-screen keyboard's height while `active`, 0 otherwise. */
export function useKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!active) {
      setHeight(0);
      return;
    }
    // Already up when this starts listening: no show event is coming for it.
    // The web has no on-screen keyboard to measure, and no `metrics` to ask.
    setHeight(Platform.OS === 'web' ? 0 : (Keyboard.metrics()?.height ?? 0));
    const names = keyboardEventNames(Platform.OS);
    const show = Keyboard.addListener(names.show, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(names.hide, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);

  return height;
}

/** Bottom margin that keeps a Paper Dialog clear of the on-screen keyboard. */
export function useDialogKeyboardLift(active: boolean): number {
  return dialogKeyboardLift(useKeyboardHeight(active));
}
