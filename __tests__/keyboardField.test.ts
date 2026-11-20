/**
 * A text field written on a scrolling page, and the keyboard that opens over it.
 *
 * With Android edge-to-edge the window does not shrink for the keyboard, so a
 * list that does nothing about it keeps its full height and the keyboard simply
 * lies on top of its lower half — the quick-add field on Today was typed blind.
 * The list has to give up the covered part itself and then bring the field
 * into what is left.
 */
import {
  keyboardOverlap,
  keyboardRevealDelta,
  keyboardTopInWindow,
  touchIsOutside,
} from '../src/screens/shared/keyboardField';

describe('keyboardTopInWindow', () => {
  it('is null while no keyboard is up', () => {
    expect(keyboardTopInWindow({ windowHeight: 900, safeBottom: 24, keyboardHeight: 0 })).toBeNull();
    expect(
      keyboardTopInWindow({ windowHeight: 900, safeBottom: 24, keyboardHeight: Number.NaN }),
    ).toBeNull();
  });

  it('stands the keyboard on the navigation bar, which its reported height leaves out', () => {
    expect(keyboardTopInWindow({ windowHeight: 900, safeBottom: 24, keyboardHeight: 300 })).toBe(576);
  });
});

describe('keyboardOverlap', () => {
  it('is nothing without a keyboard', () => {
    expect(keyboardOverlap({ viewBottom: 840, keyboardTop: null })).toBe(0);
  });

  it('is the part of the list under the keyboard, not the dock below the list', () => {
    // The list ends at 840 above a 60pt dock; the keyboard rises to 576.
    expect(keyboardOverlap({ viewBottom: 840, keyboardTop: 576 })).toBe(264);
  });

  it('is nothing for a list that already ends above the keyboard', () => {
    expect(keyboardOverlap({ viewBottom: 500, keyboardTop: 576 })).toBe(0);
  });
});

describe('keyboardRevealDelta', () => {
  const room = { viewportTop: 40, keyboardTop: 576, peek: 72 };

  it('leaves a field alone that already has its row of room over the keyboard', () => {
    expect(keyboardRevealDelta({ ...room, fieldTop: 300, fieldBottom: 352 })).toBe(0);
    expect(keyboardRevealDelta({ ...room, fieldTop: 452, fieldBottom: 504 })).toBe(0);
  });

  it('scrolls a covered field up until a row of room shows under it', () => {
    // Near the bottom of a long list: the field lies behind the keyboard.
    expect(keyboardRevealDelta({ ...room, fieldTop: 700, fieldBottom: 752 })).toBe(248);
  });

  it('scrolls a field that is only partly clear of the keyboard', () => {
    expect(keyboardRevealDelta({ ...room, fieldTop: 540, fieldBottom: 592 })).toBe(88);
  });

  it('scrolls back down to a field that has left through the top', () => {
    expect(keyboardRevealDelta({ ...room, fieldTop: 10, fieldBottom: 62 })).toBe(-30);
  });

  it('never pushes the top of the field out to make the room under it', () => {
    // A font scale that leaves less room than the field and its peek need.
    expect(
      keyboardRevealDelta({ viewportTop: 40, keyboardTop: 140, peek: 72, fieldTop: 100, fieldBottom: 152 }),
    ).toBe(60);
  });
});

describe('touchIsOutside', () => {
  const field = { x: 16, y: 400, width: 360, height: 52 };

  it('is false for a touch on the field or the control beside it', () => {
    expect(touchIsOutside({ x: 100, y: 420 }, field)).toBe(false);
    expect(touchIsOutside({ x: 370, y: 451 }, field)).toBe(false);
  });

  it('is true for a touch on any other row', () => {
    expect(touchIsOutside({ x: 100, y: 300 }, field)).toBe(true);
    expect(touchIsOutside({ x: 100, y: 460 }, field)).toBe(true);
    expect(touchIsOutside({ x: 5, y: 420 }, field)).toBe(true);
  });
});
