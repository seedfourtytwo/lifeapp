/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * The Nutrition tab's header while food data is still loading.
 *
 * Every other Home tab shows its real day header under the spinner, so the
 * date and the journal button are already in place when the rows arrive. This
 * pins that Nutrition does the same: a bare spinner made the header — and the
 * food-journal button beside the date — pop in a beat late, moving the row
 * under the user's thumb.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import type { FoodItem, FoodLogEntry } from '../src/protocol';
import type { HomeNotebookChip } from '../src/notes';
import type { FoodJournalAffordance } from '../src/nutrition/useFoodJournal';

type FoodStoreShape = {
  items: FoodItem[];
  weekEntries: FoodLogEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  weekStart: string | null;
  loadWeek: (date: string) => Promise<void>;
  toggleLogged: (input: {
    foodId: string;
    date: string;
    logged: boolean;
  }) => Promise<void>;
  create: (input: unknown) => Promise<FoodItem | null>;
};

const mockFoodState: FoodStoreShape = {
  items: [],
  weekEntries: [],
  loaded: false,
  loading: true,
  error: null,
  weekStart: null,
  loadWeek: async () => {},
  toggleLogged: async () => {},
  create: async () => null,
};

const mockFoodJournal: FoodJournalAffordance = {
  ready: true,
  notebook: null,
  starting: false,
  start: () => {},
};

jest.mock('../src/store/foodStore', () => ({
  useFoodStore: (selector: (state: FoodStoreShape) => unknown) => selector(mockFoodState),
  activeFoodItems: (items: FoodItem[]) => items,
}));

jest.mock('../src/nutrition/useFoodJournal', () => ({
  useFoodJournal: () => mockFoodJournal,
}));

import NutritionScreen from '../src/screens/NutritionScreen';

const FOOD_NOTEBOOK: HomeNotebookChip = {
  id: 'notebook-food',
  name: 'Food journal',
  color: '#16A34A',
  icon: 'silverware-fork-knife',
  hasToday: false,
  todayCount: 0,
};

type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

function accessibilityLabels(node: Node, found: string[] = []): string[] {
  if (node == null || typeof node === 'string') return found;
  const label = node.props?.accessibilityLabel;
  if (typeof label === 'string') found.push(label);
  for (const child of node.children ?? []) accessibilityLabels(child, found);
  return found;
}

function renderNutrition(): string[] {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 800 },
            insets: { top: 24, left: 0, right: 0, bottom: 48 },
          },
        },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(
            NavigationContainer,
            null,
            React.createElement(NutritionScreen, {
              notebooks: [FOOD_NOTEBOOK],
              onDictateNotebook: () => {},
              onEditNotebook: () => {},
            }),
          ),
        ),
      ),
    );
  });
  const labels = accessibilityLabels(tree.toJSON() as Node);
  act(() => {
    tree.unmount();
  });
  return labels;
}

describe('the Nutrition tab while food data loads', () => {
  beforeEach(() => {
    mockFoodState.loaded = false;
    mockFoodState.loading = true;
    mockFoodJournal.ready = true;
    mockFoodJournal.notebook = null;
  });

  it('shows the day header, not a bare spinner', () => {
    const labels = renderNutrition();
    // The header renders the calendar peek on every Home tab — its presence is
    // how we know the header itself is up, spinner or no spinner.
    expect(labels).toContain('Open calendar');
  });

  it('keeps the food-journal button in place once the notebook exists', () => {
    mockFoodJournal.notebook = FOOD_NOTEBOOK;
    const loadingLabels = renderNutrition();
    expect(loadingLabels.join(' | ')).toContain('Food journal');

    mockFoodState.loaded = true;
    mockFoodState.loading = false;
    const loadedLabels = renderNutrition();
    // Same control, same slot: nothing to shift when the rows land.
    expect(loadingLabels.filter((label) => label.includes('Food journal'))).toEqual(
      loadedLabels.filter((label) => label.includes('Food journal')),
    );
  });

  it('offers to start the food journal when there is not one yet', () => {
    const labels = renderNutrition();
    expect(labels).toContain('Start a food journal');
  });

  it('leaves the action slot empty until the notebook pointer is read', () => {
    mockFoodJournal.ready = false;
    const labels = renderNutrition();
    expect(labels).toContain('Open calendar');
    expect(labels).not.toContain('Start a food journal');
  });
});
