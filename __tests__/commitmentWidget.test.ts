/**
 * The commitment's card on Habits: a short clock, the next lamp, the count
 * ridden out and one Urge button; during a ride only its time left, which
 * opens the ride's own screen.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Button, PaperProvider } from 'react-native-paper';
import { CommitmentWidget, type CommitmentWidgetProps } from '../src/kinds/commitment/CommitmentWidget';
import { CommitmentConfigSchema, PROTOCOL_VERSION, type CommitmentElement } from '../src/protocol';
import { appLightTheme } from '../src/theme/themes';

jest.mock('../src/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeMode: 'light',
    decorations: {
      borderWidth: 1.5,
      radius: { sm: 8, md: 14, lg: 20 },
      tabRadius: 14,
      progressHeight: 4,
      buttonRadius: 999,
    },
  }),
}));

const CLEAR_SINCE = new Date(2026, 2, 8, 7, 0);
const NOW = new Date(2026, 2, 10, 21, 30);

const commitment: CommitmentElement = {
  id: '550e8400-e29b-41d4-a716-446655440c01',
  kind: 'commitment',
  name: 'No buying',
  config: CommitmentConfigSchema.parse({ clearSince: CLEAR_SINCE.toISOString() }),
  protocolVersion: PROTOCOL_VERSION,
  createdAt: CLEAR_SINCE.toISOString(),
  archivedAt: null,
};

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
});

function render(props: Partial<CommitmentWidgetProps>): ReactTestInstance {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(PaperProvider, {
        theme: appLightTheme,
        children: React.createElement(CommitmentWidget, {
          element: commitment,
          now: NOW,
          riddenOutTotal: 4,
          ride: null,
          onUrge: () => {},
          onOpenRide: () => {},
          onLogSlip: () => {},
          onOpenDetails: () => {},
          ...props,
        }),
      }),
    );
  });
  mounted.push(tree);
  return tree.root;
}

const texts = (root: ReactTestInstance) =>
  root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);

const button = (root: ReactTestInstance, label: string) =>
  root.findAllByType(Button).find((node) => node.props.accessibilityLabel === label);

function press(root: ReactTestInstance, label: string): void {
  const found = button(root, label);
  if (!found) throw new Error(`no button ${label}`);
  act(() => (found.props.onPress as () => void)());
}

describe('the commitment card', () => {
  it('shows time clear, the next lamp and the urges ridden out', () => {
    const root = render({});
    // 62 h 30 m clear; the 72-hour lamp is next.
    expect(texts(root)).toEqual(expect.arrayContaining(['2d 14h', 'Next 3d · 4 ridden out']));
  });

  it('logs an urge with one press, asking nothing', () => {
    const onUrge = jest.fn();
    press(render({ onUrge }), 'Log an urge');
    expect(onUrge).toHaveBeenCalledTimes(1);
  });

  it('during a ride shows only that it runs and its time left, and opens it when pressed', () => {
    const onOpenRide = jest.fn();
    const ride = {
      urgeId: '550e8400-e29b-41d4-a716-446655440c03',
      startedAt: new Date(NOW.getTime() - 138_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 462_000).toISOString(),
    };
    const root = render({ ride, onOpenRide });

    expect(texts(root)).toContain('07:42');
    expect(texts(root)).not.toContain('I used');
    expect(button(root, 'Log an urge')).toBeUndefined();
    press(root, '07:42 left in the ride. Open it');
    expect(onOpenRide).toHaveBeenCalledTimes(1);
  });

  it('shows no ride once its end has passed, before the app has caught up', () => {
    const ride = {
      urgeId: '550e8400-e29b-41d4-a716-446655440c03',
      startedAt: new Date(NOW.getTime() - 601_000).toISOString(),
      endsAt: new Date(NOW.getTime() - 1_000).toISOString(),
    };
    const root = render({ ride });
    expect(texts(root)).not.toContain('00:00');
    expect(button(root, 'Log an urge')).toBeDefined();
  });
});
