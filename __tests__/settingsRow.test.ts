/**
 * Settings rows and groups, rendered.
 *
 * The look these pin is the calm list from the review: glyphs bare in the
 * quiet ink (no tinted wells), a heading in the caption size, rows on one
 * surface tile, and a switch that is moss when on and a plain grey track when
 * off — not Paper's half-transparent Material 2 track.
 */
import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {
  StyleSheet,
  Switch,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PaperProvider, Surface, type MD3Theme } from 'react-native-paper';
import SettingsGroup from '../src/components/settings/SettingsGroup';
import SettingsRow from '../src/components/settings/SettingsRow';
import SettingsSwitch from '../src/components/settings/SettingsSwitch';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';
import { getThemeDecorations } from '../src/theme/decorations';

function mount(element: React.ReactElement, theme: MD3Theme = appLightTheme) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(PaperProvider, { theme, children: element }));
  });
  return renderer;
}

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
const flat = (node: ReactTestInstance): TextStyle & ViewStyle =>
  StyleSheet.flatten(node.props.style as StyleProp<TextStyle & ViewStyle>) ?? {};

describe('SettingsSwitch', () => {
  it.each([
    ['light', appLightTheme],
    ['dark', appDarkTheme],
  ] as const)('is moss when on and a plain track when off (%s)', (_mode, theme) => {
    const on = mount(React.createElement(SettingsSwitch, { value: true }), theme);
    const sw = on.root.findByType(Switch);
    expect(sw.props.trackColor).toEqual({
      true: theme.colors.primary,
      false: theme.colors.outline,
    });
    expect(sw.props.thumbColor).toBe(theme.colors.onPrimary);

    const off = mount(React.createElement(SettingsSwitch, { value: false }), theme);
    expect(off.root.findByType(Switch).props.thumbColor).not.toBe(theme.colors.primary);
  });
});

describe('SettingsRow', () => {
  it('draws its glyph bare, in the quiet ink, at 24', () => {
    const r = mount(React.createElement(SettingsRow, { icon: 'translate', title: 'Language' }));
    const icon = r.root.findByType(MaterialCommunityIcons);
    expect(icon.props.size).toBe(24);
    expect(icon.props.color).toBe(appLightTheme.colors.onSurfaceVariant);
    const slot = icon.parent as ReactTestInstance;
    expect(flat(slot).backgroundColor).toBeUndefined();
  });

  it('sets its value on the right in the quiet ink', () => {
    const r = mount(
      React.createElement(SettingsRow, { icon: 'translate', title: 'Language', trailingValue: 'System' }),
    );
    const value = r.root.findAllByType(Text).find((n: ReactTestInstance) => n.props.children === 'System');
    expect(value).toBeDefined();
    expect(flat(value as ReactTestInstance).color).toBe(appLightTheme.colors.onSurfaceVariant);
  });

  it('uses the moss switch for a switch row and stays one accessible switch', () => {
    const r = mount(
      React.createElement(SettingsRow, {
        icon: 'weather-partly-cloudy',
        title: 'Weather',
        switchValue: true,
        onSwitch: jest.fn(),
      }),
    );
    expect(r.root.findAllByType(SettingsSwitch)).toHaveLength(1);
    const switches = pressables(r.root, 'switch');
    expect(switches).toHaveLength(1);
    expect(switches[0].props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('SettingsGroup', () => {
  it('heads the group in the caption size and sets rows on one surface tile', () => {
    const r = mount(
      React.createElement(SettingsGroup, {
        title: 'Look',
        children: [
          React.createElement(SettingsRow, { key: 'a', title: 'A' }),
          React.createElement(SettingsRow, { key: 'b', title: 'B' }),
        ],
      }),
    );
    const heading = r.root.findAllByType(Text).find((n: ReactTestInstance) => n.props.children === 'Look');
    const headingStyle = flat(heading as ReactTestInstance);
    expect(headingStyle.fontSize).toBeGreaterThanOrEqual(13);
    expect(headingStyle.fontSize).toBeLessThanOrEqual(14);
    expect(headingStyle.color).toBe(appLightTheme.colors.onSurfaceVariant);

    const tile = r.root.findByType(Surface);
    const tileStyle = flat(tile);
    expect(tileStyle.backgroundColor).toBe(appLightTheme.colors.surface);
    expect(tileStyle.borderRadius).toBe(getThemeDecorations('light').radius.lg);
  });
});
