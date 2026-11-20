import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import '../src/i18n';
import { useUndoBar, type UndoBar } from '../src/screens/today/useUndoBar';

/** Mounts the hook and hands back a live view of it. */
function mountBar(): { bar: () => UndoBar; unmount: () => void } {
  let current!: UndoBar;
  function Probe() {
    current = useUndoBar();
    return null;
  }
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(React.createElement(Probe));
  });
  return { bar: () => current, unmount: () => act(() => tree.unmount()) };
}

describe('useUndoBar', () => {
  it('shows the latest offer', () => {
    const { bar } = mountBar();
    expect(bar().message).toBeNull();

    act(() => bar().offer({ message: 'Water +1', undo: jest.fn() }));

    expect(bar().message).toBe('Water +1');
  });

  it('settles what was pending when something newer takes the bar', () => {
    const { bar } = mountBar();
    const first = { message: 'Deleted — Milk', undo: jest.fn(), settle: jest.fn() };
    const second = { message: 'Water +1', undo: jest.fn(), settle: jest.fn() };

    act(() => bar().offer(first));
    act(() => bar().offer(second));

    expect(first.settle).toHaveBeenCalledTimes(1);
    expect(first.undo).not.toHaveBeenCalled();
    expect(second.settle).not.toHaveBeenCalled();
    expect(bar().message).toBe('Water +1');
  });

  it('runs the undo and never the settle when Undo is pressed', async () => {
    const { bar } = mountBar();
    const pending = { message: 'Deleted — Milk', undo: jest.fn(), settle: jest.fn() };
    act(() => bar().offer(pending));

    await act(async () => bar().runUndo());
    // Paper dismisses the bar right after its action: that must not settle it.
    act(() => bar().settle());

    expect(pending.undo).toHaveBeenCalledTimes(1);
    expect(pending.settle).not.toHaveBeenCalled();
    expect(bar().message).toBeNull();
  });

  it('settles once when the window runs out', () => {
    const { bar } = mountBar();
    const pending = { message: 'Deleted — Milk', undo: jest.fn(), settle: jest.fn() };
    act(() => bar().offer(pending));

    act(() => bar().settle());
    act(() => bar().settle());

    expect(pending.settle).toHaveBeenCalledTimes(1);
    expect(bar().message).toBeNull();
  });

  it('still settles a pending undo when the page unmounts', () => {
    const { bar, unmount } = mountBar();
    const pending = { message: 'Deleted — Milk', undo: jest.fn(), settle: jest.fn() };
    act(() => bar().offer(pending));

    unmount();

    expect(pending.settle).toHaveBeenCalledTimes(1);
  });

  it('lets an owner withdraw only its own undo', () => {
    const { bar } = mountBar();
    const pending = { message: 'Deleted — Milk', undo: jest.fn(), settle: jest.fn() };
    act(() => bar().offer(pending));

    act(() => bar().settle('counters'));
    expect(bar().message).toBe('Deleted — Milk');
    expect(pending.settle).not.toHaveBeenCalled();

    act(() => bar().offer({ message: 'Water +1', undo: jest.fn(), owner: 'counters' }));
    act(() => bar().settle('counters'));
    expect(bar().message).toBeNull();
  });
});
