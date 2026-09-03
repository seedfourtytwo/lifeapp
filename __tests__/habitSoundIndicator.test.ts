/**
 * The Home card has to say, at a glance, whether a timer habit will play a
 * sound and what happens when the track ends.
 *
 * Two things are deliberately *not* indicated:
 *  - loudness — there is no per-tracker volume in the app, so there is nothing
 *    to show (the timer player only toggles `muted`);
 *  - a sound on anything that cannot play one — counters have no sound field,
 *    and a boolean habit ignores `timerSound` everywhere else in the protocol,
 *    so a stale entry left over from switching modes must stay silent here too.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { describeHabitCardSound } from '../src/kinds/habit/habitCardLabels';
import { HabitSoundIndicator } from '../src/kinds/habit/HabitSoundIndicator';
import { buildHabitConfig, type HabitConfig } from '../src/protocol';

function timerHabit(overrides: Partial<HabitConfig> = {}): HabitConfig {
  return {
    ...buildHabitConfig({ trackingMode: 'timer' }),
    ...overrides,
  };
}

describe('describeHabitCardSound', () => {
  it('marks a looping track with the repeat glyph', () => {
    const indicator = describeHabitCardSound(
      timerHabit({ timerSound: { trackId: 'meditation15min' } }),
    );

    expect(indicator).toEqual({
      mode: 'loop',
      icon: 'repeat',
      accessibilityLabel: 'Sound loops while the timer runs',
    });
  });

  it('marks a play-once track with the music-note glyph', () => {
    const indicator = describeHabitCardSound(
      timerHabit({
        timerSound: { trackId: 'meditation30min', playbackMode: 'play_once' },
      }),
    );

    expect(indicator).toEqual({
      mode: 'play_once',
      icon: 'music-note',
      accessibilityLabel: 'Sound plays once, then the timer stops',
    });
  });

  it('shows nothing when no sound is attached', () => {
    expect(describeHabitCardSound(timerHabit())).toBeNull();
  });

  it('shows nothing for a track id that is not in the bundled catalog', () => {
    expect(
      describeHabitCardSound(timerHabit({ timerSound: { trackId: 'gone-in-a-rebuild' } })),
    ).toBeNull();
  });

  it('shows nothing for a boolean habit carrying a stale timer sound', () => {
    const stale = {
      ...buildHabitConfig({ trackingMode: 'boolean' }),
      timerSound: { trackId: 'meditation15min', playbackMode: 'loop' as const },
    };

    expect(stale.timerSound).toBeDefined();
    expect(describeHabitCardSound(stale)).toBeNull();
  });
});

describe('HabitSoundIndicator', () => {
  type Node =
    | { type?: unknown; props?: Record<string, unknown>; children?: Node[] | null }
    | string
    | null;

  /** Async: the icon font resolves on a microtask and re-renders the glyph. */
  async function render(mode: 'loop' | 'play_once'): Promise<Node> {
    const indicator = describeHabitCardSound(
      timerHabit({ timerSound: { trackId: 'meditation15min', playbackMode: mode } }),
    );
    expect(indicator).not.toBeNull();

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(HabitSoundIndicator, {
          indicator: indicator!,
          color: '#000000',
        }),
      );
    });
    const json = tree.toJSON() as Node;
    act(() => tree.unmount());
    return json;
  }

  function flatten(node: Node, found: Record<string, unknown>[] = []) {
    if (node == null || typeof node === 'string') return found;
    if (node.props) found.push(node.props);
    for (const child of node.children ?? []) flatten(child, found);
    return found;
  }

  /**
   * The card announces the name, streak, elapsed time and each button, but
   * nothing else mentions the sound — so this glyph has to speak for itself.
   */
  it('announces the sound to a screen reader', async () => {
    const props = flatten(await render('play_once'));
    const labelled = props.filter((p) => p.accessibilityLabel);

    expect(labelled).toHaveLength(1);
    expect(labelled[0]!.accessibilityLabel).toBe('Sound plays once, then the timer stops');
    expect(labelled[0]!.accessible).toBe(true);
  });

  it('never dims itself or pins a height', async () => {
    for (const mode of ['loop', 'play_once'] as const) {
      for (const props of flatten(await render(mode))) {
        const style = props.style as Record<string, unknown> | undefined;
        if (!style) continue;
        expect(style.opacity).toBeUndefined();
        expect(style.height).toBeUndefined();
      }
    }
  });
});
