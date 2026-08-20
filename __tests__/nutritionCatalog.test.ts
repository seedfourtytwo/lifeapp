import {
  FoodItemSchema,
  PROTOCOL_VERSION,
  type FoodGroup,
  type FoodItem,
} from '../src/protocol';
import {
  DEFAULT_FOOD_FILTER,
  catalogHasFoodNamed,
  countActiveFoodFilters,
  filterFoods,
  isFoodFilterActive,
  sortFoods,
  type NamedFood,
} from '../src/nutrition/foodFilters';
import { searchFoodItems } from '../src/nutrition/search';
import {
  draftFromItem,
  draftToInput,
  parseAliases,
  parseDecimal,
} from '../src/screens/nutrition/ingredientEditorState';

let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return FoodItemSchema.parse({
    id: uuid(),
    name: 'Food',
    group: 'vegetable' satisfies FoodGroup,
    createdAt: '2026-08-17T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

function named(item: FoodItem, name = item.name): NamedFood {
  return { item, name };
}

describe('food filters', () => {
  const carrot = food({ name: 'Carrot', group: 'vegetable', seasonMonths: [7, 8] });
  const cheddar = food({ name: 'Cheddar', group: 'dairy' });
  const apple = food({ name: 'Apple', group: 'fruit', seasonMonths: [9, 10] });
  const entries = [named(carrot), named(cheddar), named(apple)];

  it('passes everything through by default', () => {
    const result = filterFoods(entries, DEFAULT_FOOD_FILTER, { month: 7 });
    expect(result).toHaveLength(3);
    expect(isFoodFilterActive(DEFAULT_FOOD_FILTER)).toBe(false);
  });

  it('filters by group', () => {
    const result = filterFoods(
      entries,
      { ...DEFAULT_FOOD_FILTER, group: 'dairy' },
      { month: 7 },
    );
    expect(result.map((e) => e.item.id)).toEqual([cheddar.id]);
  });

  it('filters to plants only', () => {
    const result = filterFoods(
      entries,
      { ...DEFAULT_FOOD_FILTER, plantsOnly: true },
      { month: 7 },
    );
    expect(result.map((e) => e.item.id).sort()).toEqual([apple.id, carrot.id].sort());
  });

  it('filters to what is in season this month', () => {
    const july = filterFoods(
      entries,
      { ...DEFAULT_FOOD_FILTER, inSeasonOnly: true },
      { month: 7 },
    );
    expect(july.map((e) => e.item.id)).toEqual([carrot.id]);

    const october = filterFoods(
      entries,
      { ...DEFAULT_FOOD_FILTER, inSeasonOnly: true },
      { month: 10 },
    );
    expect(october.map((e) => e.item.id)).toEqual([apple.id]);
  });

  it('combines filters', () => {
    const result = filterFoods(
      entries,
      { ...DEFAULT_FOOD_FILTER, plantsOnly: true, inSeasonOnly: true },
      { month: 7 },
    );
    expect(result.map((e) => e.item.id)).toEqual([carrot.id]);
  });

  it('counts how many filters are on', () => {
    expect(countActiveFoodFilters(DEFAULT_FOOD_FILTER)).toBe(0);
    expect(
      countActiveFoodFilters({ group: 'fruit', plantsOnly: true, inSeasonOnly: false }),
    ).toBe(2);
    expect(
      isFoodFilterActive({ group: null, plantsOnly: false, inSeasonOnly: true }),
    ).toBe(true);
  });
});

describe('food sorting', () => {
  it('sorts by name, accent-insensitively', () => {
    const entries = [
      named(food({ name: 'Épinard' })),
      named(food({ name: 'Avocat' })),
      named(food({ name: 'Endive' })),
    ];
    const sorted = sortFoods(entries, 'name', { month: 7 }, 'fr-FR');
    expect(sorted.map((e) => e.name)).toEqual(['Avocat', 'Endive', 'Épinard']);
  });

  it('sorts by group, then name within a group', () => {
    const entries = [
      named(food({ name: 'Cheddar', group: 'dairy' })),
      named(food({ name: 'Tomato', group: 'vegetable' })),
      named(food({ name: 'Carrot', group: 'vegetable' })),
    ];
    const sorted = sortFoods(entries, 'group', { month: 7 });
    expect(sorted.map((e) => e.name)).toEqual(['Carrot', 'Tomato', 'Cheddar']);
  });

  it('puts peak season first, then in season, then the rest', () => {
    const peak = food({ name: 'Peak', seasonMonths: [7, 8], peakMonths: [7] });
    const inSeason = food({ name: 'InSeason', seasonMonths: [7, 8] });
    const off = food({ name: 'Off', seasonMonths: [1] });
    const none = food({ name: 'NoSeason' });
    const sorted = sortFoods(
      [named(off), named(none), named(inSeason), named(peak)],
      'season',
      { month: 7 },
    );
    expect(sorted.map((e) => e.name)).toEqual(['Peak', 'InSeason', 'NoSeason', 'Off']);
  });

  it('does not mutate its input', () => {
    const entries = [named(food({ name: 'B' })), named(food({ name: 'A' }))];
    const before = entries.map((e) => e.name);
    sortFoods(entries, 'name', { month: 7 });
    expect(entries.map((e) => e.name)).toEqual(before);
  });
});

describe('ingredient editor draft', () => {
  it('accepts a comma decimal separator', () => {
    // French number pads produce a comma; rejecting it would look like a bug.
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('1.5')).toBe(1.5);
  });

  it('treats empty as unset and rubbish as an error', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('   ')).toBeUndefined();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('splits aliases and drops the blanks', () => {
    expect(parseAliases(' zucchini , courgette ,, ')).toEqual(['zucchini', 'courgette']);
    expect(parseAliases('   ')).toBeUndefined();
  });

  it('requires a name', () => {
    const result = draftToInput({ ...draftFromItem(undefined), name: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('nameRequired');
  });

  it('builds a minimal input from just a name and group', () => {
    const result = draftToInput({ ...draftFromItem(undefined), name: 'Kefir', group: 'dairy' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).toMatchObject({ name: 'Kefir', group: 'dairy' });
      expect(result.input.nutrients).toBeUndefined();
      expect(result.input.seasonMonths).toBeUndefined();
      expect(result.input.portions).toBeUndefined();
    }
  });

  it('omits the plant override when it matches the group default', () => {
    const asPlant = draftToInput({
      ...draftFromItem(undefined),
      name: 'Carrot',
      group: 'vegetable',
      countsAsPlant: true,
    });
    expect(asPlant.ok && asPlant.input.countsAsPlant).toBeUndefined();

    const overridden = draftToInput({
      ...draftFromItem(undefined),
      name: 'White bread',
      group: 'grain',
      countsAsPlant: false,
    });
    expect(overridden.ok && overridden.input.countsAsPlant).toBe(false);
  });

  it('reports which numeric field is not a number', () => {
    const result = draftToInput({ ...draftFromItem(undefined), name: 'X', proteinG: 'lots' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'notANumber') {
      expect(result.error.field).toBe('proteinG');
    } else {
      throw new Error('expected a notANumber error');
    }
  });

  it('drops a blank portion row but rejects a half-filled one', () => {
    const blank = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      portions: [{ label: '', grams: '' }],
    });
    expect(blank.ok && blank.input.portions).toBeUndefined();

    const half = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      portions: [{ label: '1 medium', grams: '' }],
    });
    expect(half.ok).toBe(false);
    if (!half.ok) expect(half.error.kind).toBe('portionIncomplete');
  });

  it('drops peak months that are not in the season', () => {
    const result = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      seasonMonths: [6, 7],
      peakMonths: [7, 11],
    });
    expect(result.ok && result.input.peakMonths).toEqual([7]);
  });

  it('lower-cases the diversity key so varieties actually match', () => {
    const result = draftToInput({
      ...draftFromItem(undefined),
      name: 'Granny Smith',
      diversityKey: ' Apple ',
    });
    expect(result.ok && result.input.diversityKey).toBe('apple');
  });

  it('round-trips an existing food through the draft unchanged', () => {
    const item = food({
      name: 'Carrot',
      group: 'vegetable',
      seasonMonths: [6, 7],
      peakMonths: [7],
      nutrients: { basis: 'per100g', state: 'raw', energyKcal: 41, carbsG: 6.8, sugarsG: 4.7 },
      glycemicIndex: 39,
      portions: [{ label: '1 medium', grams: 61 }],
      aliases: ['carotte'],
    });
    const result = draftToInput(draftFromItem(item));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      name: 'Carrot',
      group: 'vegetable',
      seasonMonths: [6, 7],
      peakMonths: [7],
      glycemicIndex: 39,
      aliases: ['carotte'],
      portions: [{ label: '1 medium', grams: 61 }],
    });
    expect(result.input.nutrients).toMatchObject({ basis: 'per100g', state: 'raw', energyKcal: 41 });
    // And the rebuilt input must still satisfy the schema.
    expect(() =>
      FoodItemSchema.parse({
        id: uuid(),
        createdAt: '2026-08-17T09:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        ...result.input,
      }),
    ).not.toThrow();
  });

  it('catches sugars above carbs before Zod does, so the message can be translated', () => {
    const result = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      carbsG: '3',
      sugarsG: '5',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('sugarsAboveCarbs');
  });

  it('catches saturated fat above total fat', () => {
    const result = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      fatG: '2',
      satFatG: '4',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('satFatAboveFat');
  });

  it('allows sugars exactly equal to carbs', () => {
    const result = draftToInput({
      ...draftFromItem(undefined),
      name: 'X',
      carbsG: '4.2',
      sugarsG: '4.2',
    });
    expect(result.ok).toBe(true);
  });

  it('leaves the state off when it was never set', () => {
    const result = draftToInput({ ...draftFromItem(undefined), name: 'X', energyKcal: '10' });
    expect(result.ok && result.input.nutrients).toEqual({ basis: 'per100g', energyKcal: 10 });
  });
});

describe('catalogHasFoodNamed', () => {
  // Regression: the "Add X" button used to compare against the *visible* rows,
  // so a food hidden by a filter (or archived, or under its English name) could
  // be added a second time.
  const carrot = food({ slug: 'carrot', name: 'Carrot' });
  const archived = food({ name: 'Old sauce', archivedAt: '2026-08-01T09:00:00.000Z' });

  it('matches a display name that differs from the stored name', () => {
    const entries = [named(carrot, 'Carotte')];
    expect(catalogHasFoodNamed(entries, [carrot], 'Carotte')).toBe(true);
    expect(catalogHasFoodNamed(entries, [carrot], 'Carrot')).toBe(true);
  });

  it('matches a food the visible rows have filtered out', () => {
    expect(catalogHasFoodNamed([], [carrot], 'Carrot')).toBe(true);
  });

  it('matches an archived food, which a new one would collide with', () => {
    expect(catalogHasFoodNamed([], [archived], 'Old sauce')).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(catalogHasFoodNamed([], [carrot], '  cArRoT ')).toBe(true);
  });

  it('is false for a genuinely new name, and for blank input', () => {
    expect(catalogHasFoodNamed([named(carrot)], [carrot], 'Kefir')).toBe(false);
    expect(catalogHasFoodNamed([named(carrot)], [carrot], '   ')).toBe(false);
  });
});

describe('search ranking', () => {
  it('ranks a word-start match above a mid-word one', () => {
    const oliveOil = food({ name: 'Olive oil' });
    const broiled = food({ name: 'Broiled pepper' });
    const ranked = searchFoodItems([broiled, oliveOil], 'oil');
    expect(ranked.map((i) => i.id)).toEqual([oliveOil.id, broiled.id]);
  });

  it('ranks exact over prefix over word-start', () => {
    const exact = food({ name: 'Oil' });
    const prefix = food({ name: 'Oilseed rape' });
    const wordStart = food({ name: 'Olive oil' });
    const ranked = searchFoodItems([wordStart, prefix, exact], 'oil');
    expect(ranked.map((i) => i.id)).toEqual([exact.id, prefix.id, wordStart.id]);
  });

  it('still matches every alias after the per-query regex hoist', () => {
    const courgette = food({ name: 'Courgette', aliases: ['zucchini', 'summer squash'] });
    expect(searchFoodItems([courgette], 'squash')).toHaveLength(1);
    expect(searchFoodItems([courgette], 'zucchini')).toHaveLength(1);
  });

  it('treats a regex metacharacter in the query as literal text', () => {
    const weird = food({ name: 'Cream (30%)' });
    const other = food({ name: 'Milk' });
    expect(searchFoodItems([weird, other], '(30%)').map((i) => i.id)).toEqual([weird.id]);
    expect(searchFoodItems([weird, other], '.*')).toHaveLength(0);
  });
});
