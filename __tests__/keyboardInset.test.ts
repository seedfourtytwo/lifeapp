import { dialogKeyboardLift, keyboardEventNames } from '../src/hooks/keyboardInset';

describe('dialogKeyboardLift', () => {
  it('is zero with no keyboard', () => {
    expect(dialogKeyboardLift(0)).toBe(0);
  });

  it('reserves the keyboard height plus a gap so the dialog sits above it', () => {
    expect(dialogKeyboardLift(300)).toBeGreaterThan(300);
  });

  it('ignores nonsense heights', () => {
    expect(dialogKeyboardLift(-10)).toBe(0);
    expect(dialogKeyboardLift(Number.NaN)).toBe(0);
  });
});

describe('keyboardEventNames', () => {
  it('uses the did-events on Android, where will-events never fire', () => {
    expect(keyboardEventNames('android')).toEqual({
      show: 'keyboardDidShow',
      hide: 'keyboardDidHide',
    });
  });

  it('uses the will-events on iOS so the dialog moves with the keyboard', () => {
    expect(keyboardEventNames('ios')).toEqual({
      show: 'keyboardWillShow',
      hide: 'keyboardWillHide',
    });
  });
});
