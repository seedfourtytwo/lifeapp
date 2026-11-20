/**
 * What a submit from the quick-add field means.
 *
 * Text files a todo and keeps the keyboard; an empty field says "done" and puts
 * the keyboard away. The catch is a hardware Enter: Android hands the field's
 * editor action to React Native on key-down and again on key-up, so one press
 * submits twice — and the second arrives after the first has emptied the field.
 * Read as "done", it closed the keyboard on every todo filed that way.
 */
import { quickAddSubmitAction } from '../src/screens/todos/quickAddSubmit';

describe('quickAddSubmitAction', () => {
  it('files what was typed', () => {
    expect(quickAddSubmitAction({ hasText: true, msSinceFiled: null })).toBe('file');
    expect(quickAddSubmitAction({ hasText: true, msSinceFiled: 2500 })).toBe('file');
  });

  it('puts the keyboard away on an empty field', () => {
    expect(quickAddSubmitAction({ hasText: false, msSinceFiled: null })).toBe('dismiss');
  });

  it('ignores the echo of the press that just filed a todo', () => {
    expect(quickAddSubmitAction({ hasText: false, msSinceFiled: 0 })).toBe('ignore');
    expect(quickAddSubmitAction({ hasText: false, msSinceFiled: 120 })).toBe('ignore');
  });

  it('does not file the same todo twice when the echo beats the re-render', () => {
    expect(quickAddSubmitAction({ hasText: true, msSinceFiled: 20 })).toBe('ignore');
  });

  it('takes a second, deliberate Enter after filing as "done"', () => {
    expect(quickAddSubmitAction({ hasText: false, msSinceFiled: 900 })).toBe('dismiss');
  });
});
