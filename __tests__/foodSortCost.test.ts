/**
 * What it costs to sort the food catalog.
 *
 * `String.prototype.localeCompare(other, locale, options)` builds a fresh ICU
 * collator on every call. On the phone that is ~17 ms a call, and a 200-food
 * catalog sorts in roughly 1 600 comparisons — the Ingredients screen froze
 * for over ten seconds with the JS thread blocked, so taps queued up and only
 * landed once the sort finished.
 *
 * The rule these tests pin: one collator for a whole sort, reused across
 * sorts, and never the per-call form. The alternative — "the list is small
 * enough" — is what stopped being true at 200 foods.
 */
import { sortFoods, type NamedFood } from '../src/nutrition/foodFilters';
import type { FoodItem } from '../src/protocol';

const RealCollator = Intl.Collator;
let collatorsBuilt = 0;

function countCollators() {
  collatorsBuilt = 0;
  (Intl as { Collator: typeof Intl.Collator }).Collator = new Proxy(RealCollator, {
    construct(target, args: ConstructorParameters<typeof Intl.Collator>) {
      collatorsBuilt += 1;
      return new target(...args);
    },
  });
}

afterEach(() => {
  (Intl as { Collator: typeof Intl.Collator }).Collator = RealCollator;
  jest.restoreAllMocks();
});

function food(name: string): NamedFood {
  return {
    item: {
      id: name,
      name,
      group: 'vegetable',
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      protocolVersion: 1,
    } as FoodItem,
    name,
  };
}

/** A catalog the size of a real one — the size at which this went wrong. */
function catalog(count: number): NamedFood[] {
  return Array.from({ length: count }, (_, index) =>
    food(`Food ${String(count - index).padStart(3, '0')}`),
  );
}

describe('sorting cost', () => {
  it('never falls back to the per-call localeCompare form', () => {
    const perCall = jest.spyOn(String.prototype, 'localeCompare');
    sortFoods(catalog(200), 'name', { month: 9 }, 'en-US');
    expect(perCall).not.toHaveBeenCalled();
  });

  it('builds one collator for a whole sort, not one per comparison', () => {
    countCollators();
    sortFoods(catalog(200), 'name', { month: 9 }, 'en-US');
    expect(collatorsBuilt).toBeLessThanOrEqual(1);
  });

  it('reuses that collator across sorts in the same language', () => {
    sortFoods(catalog(20), 'name', { month: 9 }, 'en-US');
    countCollators();
    sortFoods(catalog(20), 'group', { month: 9 }, 'en-US');
    sortFoods(catalog(20), 'season', { month: 9 }, 'en-US');
    expect(collatorsBuilt).toBe(0);
  });
});

describe('sorting still orders names the way a reader expects', () => {
  it('ignores case and accents, as French names need', () => {
    const sorted = sortFoods(
      [food('épinard'), food('Ail'), food('Endive')],
      'name',
      { month: 9 },
      'fr-FR',
    );
    expect(sorted.map((entry) => entry.name)).toEqual(['Ail', 'Endive', 'épinard']);
  });

  it('orders a catalog-sized list from A to Z', () => {
    const sorted = sortFoods(catalog(200), 'name', { month: 9 }, 'en-US');
    expect(sorted[0].name).toBe('Food 001');
    expect(sorted[sorted.length - 1].name).toBe('Food 200');
  });
});
