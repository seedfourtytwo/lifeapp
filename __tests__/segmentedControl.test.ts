/**
 * The segmented control, rendered.
 *
 * It replaces Paper's outlined SegmentedButtons — a row of bordered pills that
 * read as a form — with a quiet well and one raised thumb. What has to hold is
 * that it is still a real radio group: one checked option, a press reports the
 * value, and the words stay readable on the well.
 */
import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { PaperProvider } from 'react-native-paper';
import SegmentedControl from '../src/components/SegmentedControl';
import SettingsSegmented from '../src/components/settings/SettingsSegmented';
import { appLightTheme } from '../src/theme/themes';
import { getThemeDecorations } from '../src/theme/decorations';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function mount(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(PaperProvider, { theme: appLightTheme, children: element }),
    );
  });
  return renderer;
}

const radios = (root: ReactTestInstance) => pressables(root, 'radio');

/** The outermost pressable with that role: one per control, however deep it renders. */
function pressables(root: ReactTestInstance, role: string): ReactTestInstance[] {
  const hits = root.findAll(
    (n) => n.props.accessibilityRole === role && typeof n.props.onPress === 'function',
  );
  return hits.filter((n) => !hits.some((other) => other !== n && isAncestor(other, n)));
}

function isAncestor(a: ReactTestInstance, b: ReactTestInstance): boolean {
  for (let p = b.parent; p; p = p.parent) if (p === a) return true;
  return false;
}


describe('SegmentedControl', () => {
  it('is a radio group with exactly the chosen option checked', () => {
    const r = mount(
      React.createElement(SegmentedControl, { options: OPTIONS, value: 'light', onChange: jest.fn() }),
    );
    const group = r.root.findAll((n: ReactTestInstance) => n.props.accessibilityRole === 'radiogroup');
    expect(group.length).toBeGreaterThan(0);
    const states = radios(r.root).map((node: ReactTestInstance) => [
      node.props.accessibilityLabel,
      (node.props.accessibilityState as { checked?: boolean }).checked,
    ]);
    expect(states).toEqual([
      ['System', false],
      ['Light', true],
      ['Dark', false],
    ]);
  });

  it('reports a newly picked value, and stays quiet on the one already picked', () => {
    const onChange = jest.fn();
    const r = mount(
      React.createElement(SegmentedControl, { options: OPTIONS, value: 'light', onChange }),
    );
    const [system, light] = radios(r.root);
    act(() => (light.props.onPress as () => void)());
    expect(onChange).not.toHaveBeenCalled();
    act(() => (system.props.onPress as () => void)());
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('sits in a well, at least a 44dp target, with the input radius', () => {
    const r = mount(
      React.createElement(SegmentedControl, { options: OPTIONS, value: 'light', onChange: jest.fn() }),
    );
    const track = r.root.findAll((n: ReactTestInstance) => n.props.accessibilityRole === 'radiogroup')[0];
    const style = StyleSheet.flatten(track.props.style as StyleProp<ViewStyle>);
    expect(style.backgroundColor).toBe(appLightTheme.colors.surfaceVariant);
    expect(style.borderRadius).toBe(getThemeDecorations('light').radius.md);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeUndefined();
  });

  it('writes the picked word in ink and the rest in the quiet ink, at 15sp', () => {
    const r = mount(
      React.createElement(SegmentedControl, { options: OPTIONS, value: 'light', onChange: jest.fn() }),
    );
    const labels = r.root
      .findAllByType(Text)
      .map((node) => StyleSheet.flatten(node.props.style as StyleProp<TextStyle>));
    expect(labels.map((s) => s.color)).toEqual([
      appLightTheme.colors.onSurfaceVariant,
      appLightTheme.colors.onSurface,
      appLightTheme.colors.onSurfaceVariant,
    ]);
    for (const style of labels) expect(style.fontSize).toBe(15);
  });
});

describe('SettingsSegmented', () => {
  it('draws the same control, so Settings picks up the new look', () => {
    const r = mount(
      React.createElement(SettingsSegmented, {
        value: 'dark',
        onChange: jest.fn(),
        buttons: OPTIONS,
      }),
    );
    expect(r.root.findAllByType(SegmentedControl)).toHaveLength(1);
  });
});
