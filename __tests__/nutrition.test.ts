import {
  FoodItemSchema,
  FoodLogEntrySchema,
  FoodNutrientsSchema,
  PLANT_FOOD_GROUPS,
  PROTOCOL_VERSION,
  WEEKLY_PLANT_TARGET,
  foodDiversityKey,
  glycemicLoadPer100,
  isFoodInSeason,
  isPlantFood,
  validateBundleFoodLinks,
  type FoodGroup,
  type FoodItem,
  type FoodLogEntry,
} from '../src/protocol';
import { computeWeekDiversity, loggedFoodIdsForDate } from '../src/nutrition/weekDiversity';
import { normalizeFoodQuery, searchFoodItems } from '../src/nutrition/search';
import {
  SEED_FOODS,
  resolveFoodLabel,
  resolveFoodSearchTerms,
  type SeedFoodItem,
} from '../src/nutrition/seedCatalog';
import { startOfWeekDate, weekDates } from '../src/utils/dates';

let idCounter = 0;
function uuid(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return FoodItemSchema.parse({
    id: uuid(),
    name: 'Test food',
    group: 'vegetable' satisfies FoodGroup,
    createdAt: '2026-08-17T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

function logEntry(foodId: string, date: string): FoodLogEntry {
  return FoodLogEntrySchema.parse({
    id: uuid(),
    foodId,
    date,
    loggedAt: `${date}T12:00:00.000Z`,
    protocolVersion: PROTOCOL_VERSION,
  });
}

describe('week boundaries', () => {
  it('anchors every weekday to the same Monday', () => {
    // 2026-08-17 is a Monday; 2026-08-23 the Sunday that closes that week.
    for (const date of ['2026-08-17', '2026-08-19', '2026-08-23']) {
      expect(startOfWeekDate(date)).toBe('2026-08-17');
    }
  });

  it('puts Sunday at the end of the week it closes, not the start of the next', () => {
    expect(weekDates('2026-08-23')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
  });

  it('crosses month and year boundaries', () => {
    expect(startOfWeekDate('2026-01-01')).toBe('2025-12-29');
    expect(weekDates('2026-01-01')).toHaveLength(7);
  });
});

describe('plant classification', () => {
  it('counts the plant groups and excludes animal, dairy and other', () => {
    for (const group of PLANT_FOOD_GROUPS) {
      expect(isPlantFood({ group, countsAsPlant: undefined })).toBe(true);
    }
    for (const group of ['animal', 'dairy', 'other'] as const) {
      expect(isPlantFood({ group, countsAsPlant: undefined })).toBe(false);
    }
  });

  it('lets an explicit override win over the group default', () => {
    expect(isPlantFood({ group: 'grain', countsAsPlant: false })).toBe(false);
    expect(isPlantFood({ group: 'other', countsAsPlant: true })).toBe(true);
  });
});

describe('computeWeekDiversity', () => {
  it('counts a food once no matter how many days it was eaten', () => {
    const carrot = food({ name: 'Carrot' });
    const entries = [
      logEntry(carrot.id, '2026-08-17'),
      logEntry(carrot.id, '2026-08-18'),
      logEntry(carrot.id, '2026-08-19'),
    ];
    const result = computeWeekDiversity([carrot], entries);
    expect(result.plantCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('separates plants from the total distinct count', () => {
    const carrot = food({ name: 'Carrot', group: 'vegetable' });
    const chicken = food({ name: 'Chicken', group: 'animal' });
    const result = computeWeekDiversity(
      [carrot, chicken],
      [logEntry(carrot.id, '2026-08-17'), logEntry(chicken.id, '2026-08-17')],
    );
    expect(result.plantCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it('reports remaining and clamps progress once the target is passed', () => {
    const plants = Array.from({ length: WEEKLY_PLANT_TARGET + 3 }, (_, i) =>
      food({ name: `Plant ${i}` }),
    );
    const result = computeWeekDiversity(
      plants,
      plants.map((item) => logEntry(item.id, '2026-08-17')),
    );
    expect(result.plantCount).toBe(WEEKLY_PLANT_TARGET + 3);
    expect(result.remaining).toBe(0);
    expect(result.progress).toBe(1);
  });

  it('is empty-safe', () => {
    const result = computeWeekDiversity([], []);
    expect(result).toMatchObject({ plantCount: 0, totalCount: 0, progress: 0 });
    expect(result.remaining).toBe(WEEKLY_PLANT_TARGET);
  });

  it('ignores log rows whose food is gone from the catalog', () => {
    const carrot = food({ name: 'Carrot' });
    const result = computeWeekDiversity(
      [carrot],
      [logEntry(carrot.id, '2026-08-17'), logEntry(uuid(), '2026-08-17')],
    );
    expect(result.plantCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('scopes loggedFoodIdsForDate to one day', () => {
    const carrot = food();
    const apple = food({ group: 'fruit' });
    const entries = [logEntry(carrot.id, '2026-08-17'), logEntry(apple.id, '2026-08-18')];
    expect([...loggedFoodIdsForDate(entries, '2026-08-17')]).toEqual([carrot.id]);
    expect(loggedFoodIdsForDate(entries, '2026-08-20').size).toBe(0);
  });
});

describe('food search', () => {
  const carrot = food({ slug: 'carrot', name: 'Carrot' });
  const spinach = food({ slug: 'spinach', name: 'Spinach' });
  const courgette = food({ slug: 'courgette', name: 'Courgette', aliases: ['zucchini'] });
  const items = [carrot, spinach, courgette];

  it('strips diacritics so accent-free typing still matches', () => {
    expect(normalizeFoodQuery('Épinard')).toBe('epinard');
    expect(normalizeFoodQuery('Œuf')).toBe('oeuf');
  });

  it('matches an accented name without typing the accent', () => {
    const epinard = food({ name: 'Épinard' });
    expect(searchFoodItems([epinard], 'epinard').map((item) => item.id)).toEqual([epinard.id]);
  });

  it('finds a food by alias', () => {
    expect(searchFoodItems(items, 'zucchini').map((item) => item.id)).toEqual([courgette.id]);
  });

  it('ranks a prefix match above a mid-word match', () => {
    const cot = food({ name: 'Apricot' });
    const car = food({ name: 'Carrot cake' });
    const ranked = searchFoodItems([cot, car], 'car');
    expect(ranked[0]?.id).toBe(car.id);
  });

  it('returns the whole catalog for an empty or whitespace query', () => {
    expect(searchFoodItems(items, '')).toHaveLength(3);
    expect(searchFoodItems(items, '   ')).toHaveLength(3);
  });

  it('returns nothing when there is no match', () => {
    expect(searchFoodItems(items, 'zzzz')).toHaveLength(0);
  });
});

describe('seed catalog file', () => {
  // The shipped list starts empty and grows by hand; these guard the entries
  // as they are added rather than asserting any particular food is present.
  it('has unique slugs', () => {
    const slugs = SEED_FOODS.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every item an English name', () => {
    for (const item of SEED_FOODS) {
      expect(item.en.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('name resolution', () => {
  const carrotSeed: SeedFoodItem = {
    slug: 'carrot',
    en: 'Carrot',
    fr: 'Carotte',
    group: 'vegetable',
  };

  it('resolves per language', () => {
    const carrot = food({ slug: 'carrot', name: 'Carrot' });
    expect(resolveFoodLabel(carrot, carrotSeed, 'fr')).toBe('Carotte');
    expect(resolveFoodLabel(carrot, carrotSeed, 'en')).toBe('Carrot');
  });

  it('falls back to the stored name for a hand-added food', () => {
    const custom = food({ name: 'Nonna sauce' });
    expect(resolveFoodLabel(custom, undefined, 'fr')).toBe('Nonna sauce');
  });

  it('falls back to English when a seed item has no translation', () => {
    const untranslated: SeedFoodItem = { slug: 'kefir', en: 'Kefir', group: 'dairy' };
    expect(resolveFoodLabel(food({ name: 'Kefir' }), untranslated, 'fr')).toBe('Kefir');
  });

  it('keeps a renamed seed food under its new name in both languages', () => {
    const renamed = food({ slug: 'carrot', name: 'Carrot from the garden' });
    expect(resolveFoodLabel(renamed, carrotSeed, 'fr')).toBe('Carrot from the garden');
    expect(resolveFoodLabel(renamed, carrotSeed, 'en')).toBe('Carrot from the garden');
  });

  it('does not treat saving the French name unchanged as a rename', () => {
    // Editing in French prefills "Carotte"; saving it must not lose the English name.
    const saved = food({ slug: 'carrot', name: 'Carotte' });
    expect(resolveFoodLabel(saved, carrotSeed, 'en')).toBe('Carrot');
    expect(resolveFoodLabel(saved, carrotSeed, 'fr')).toBe('Carotte');
  });

  it('exposes both languages as search terms', () => {
    const spinachSeed: SeedFoodItem = {
      slug: 'spinach',
      en: 'Spinach',
      fr: 'Épinard',
      group: 'vegetable',
    };
    const terms = resolveFoodSearchTerms(food({ name: 'Spinach' }), spinachSeed);
    expect(terms).toContain('Épinard');
    expect(terms).toContain('Spinach');
  });

  it('omits a missing translation from search terms', () => {
    const terms = resolveFoodSearchTerms(food({ name: 'Kefir' }), {
      slug: 'kefir',
      en: 'Kefir',
      group: 'dairy',
    });
    expect(terms.every((term) => typeof term === 'string')).toBe(true);
  });
});

describe('optional fields', () => {
  it('accepts a food with nothing but a name and a group', () => {
    expect(() =>
      FoodItemSchema.parse({
        id: uuid(),
        name: 'Kefir',
        group: 'dairy',
        createdAt: '2026-08-17T09:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).not.toThrow();
  });

  it('defaults the nutrient basis to per 100 g', () => {
    expect(FoodNutrientsSchema.parse({ energyKcal: 41 }).basis).toBe('per100g');
    expect(FoodNutrientsSchema.parse({ basis: 'per100ml' }).basis).toBe('per100ml');
  });

  it('accepts an empty nutrients block', () => {
    expect(() => FoodNutrientsSchema.parse({})).not.toThrow();
  });

  it('still requires a name and a group', () => {
    const base = {
      id: uuid(),
      createdAt: '2026-08-17T09:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
    };
    expect(() => FoodItemSchema.parse({ ...base, group: 'dairy' })).toThrow();
    expect(() => FoodItemSchema.parse({ ...base, name: 'Kefir' })).toThrow();
  });
});

describe('validateBundleFoodLinks', () => {
  it('accepts a consistent catalog and log', () => {
    const carrot = food();
    expect(() =>
      validateBundleFoodLinks([carrot], [logEntry(carrot.id, '2026-08-17')]),
    ).not.toThrow();
  });

  it('rejects a log entry pointing at an unknown food', () => {
    expect(() => validateBundleFoodLinks([], [logEntry(uuid(), '2026-08-17')])).toThrow(
      /unknown food/,
    );
  });

  it('rejects two log rows for the same food on the same day', () => {
    const carrot = food();
    expect(() =>
      validateBundleFoodLinks(
        [carrot],
        [logEntry(carrot.id, '2026-08-17'), logEntry(carrot.id, '2026-08-17')],
      ),
    ).toThrow(/Duplicate food log entry/);
  });

  it('rejects duplicate food ids and duplicate slugs', () => {
    const carrot = food({ slug: 'carrot' });
    expect(() => validateBundleFoodLinks([carrot, carrot], [])).toThrow(/Duplicate food item/);
    expect(() =>
      validateBundleFoodLinks([carrot, food({ slug: 'carrot' })], []),
    ).toThrow(/Duplicate food slug/);
  });
});

describe('diversity key', () => {
  it('falls back to slug, then id', () => {
    expect(foodDiversityKey({ id: 'i1', slug: 'apple', diversityKey: 'pome' })).toBe('pome');
    expect(foodDiversityKey({ id: 'i1', slug: 'apple', diversityKey: undefined })).toBe('apple');
    expect(foodDiversityKey({ id: 'i1', slug: undefined, diversityKey: undefined })).toBe('i1');
  });

  it('counts two varieties of the same plant once', () => {
    const granny = food({ name: 'Granny Smith', group: 'fruit', diversityKey: 'apple' });
    const pink = food({ name: 'Pink Lady', group: 'fruit', diversityKey: 'apple' });
    const result = computeWeekDiversity(
      [granny, pink],
      [logEntry(granny.id, '2026-08-17'), logEntry(pink.id, '2026-08-18')],
    );
    expect(result.plantCount).toBe(1);
    expect(result.totalCount).toBe(1);
    // Both rows still highlight as logged even though they count once.
    expect(result.plantFoodIds.size).toBe(2);
  });

  it('lines a seed food up with a variety that names its slug', () => {
    const apple = food({ slug: 'apple', name: 'Apple', group: 'fruit' });
    const granny = food({ name: 'Granny Smith', group: 'fruit', diversityKey: 'apple' });
    const result = computeWeekDiversity(
      [apple, granny],
      [logEntry(apple.id, '2026-08-17'), logEntry(granny.id, '2026-08-17')],
    );
    expect(result.plantCount).toBe(1);
  });

  it('keeps unrelated hand-added foods separate', () => {
    const a = food({ name: 'Sauce A' });
    const b = food({ name: 'Sauce B' });
    const result = computeWeekDiversity(
      [a, b],
      [logEntry(a.id, '2026-08-17'), logEntry(b.id, '2026-08-17')],
    );
    expect(result.plantCount).toBe(2);
  });
});

describe('nutrients', () => {
  it('rejects sugars above carbohydrate', () => {
    expect(() =>
      FoodNutrientsSchema.parse({ basis: 'per100g', carbsG: 3, sugarsG: 5 }),
    ).toThrow();
  });

  it('rejects saturated fat above total fat', () => {
    expect(() => FoodNutrientsSchema.parse({ basis: 'per100g', fatG: 2, satFatG: 4 })).toThrow();
  });

  it('accepts a partially filled block', () => {
    expect(() => FoodNutrientsSchema.parse({ basis: 'per100g', energyKcal: 41 })).not.toThrow();
  });

  it('rejects peak months outside the season', () => {
    expect(() => food({ seasonMonths: [6, 7], peakMonths: [9] })).toThrow();
    expect(() => food({ seasonMonths: [6, 7, 8], peakMonths: [7] })).not.toThrow();
  });
});

describe('glycemic load', () => {
  it('derives load from index and available carbohydrate', () => {
    // EU convention: carbsG is already fibre-free, so no subtraction.
    const bread = food({
      glycemicIndex: 74,
      nutrients: { basis: 'per100g', carbsG: 34, fiberG: 7 },
    });
    expect(glycemicLoadPer100(bread)).toBeCloseTo(25.16, 2);
  });

  it('is null without an index or without carbs', () => {
    expect(glycemicLoadPer100(food({ nutrients: { basis: 'per100g', carbsG: 34 } }))).toBeNull();
    expect(glycemicLoadPer100(food({ glycemicIndex: 74 }))).toBeNull();
  });
});

describe('season', () => {
  it('reports months and treats an unrecorded season as not in season', () => {
    const tomato = food({ seasonMonths: [6, 7, 8, 9] });
    expect(isFoodInSeason(tomato, 7)).toBe(true);
    expect(isFoodInSeason(tomato, 12)).toBe(false);
    expect(isFoodInSeason(food(), 7)).toBe(false);
  });
});

describe('seed data integrity', () => {
  it('keeps sugars within carbohydrate and saturated within total fat', () => {
    for (const item of SEED_FOODS) {
      const n = item.nutrients;
      if (!n) continue;
      if (n.sugarsG != null && n.carbsG != null) {
        expect(n.sugarsG).toBeLessThanOrEqual(n.carbsG + 0.01);
      }
      if (n.satFatG != null && n.fatG != null) {
        expect(n.satFatG).toBeLessThanOrEqual(n.fatG + 0.01);
      }
    }
  });

  it('keeps peak months inside the season', () => {
    for (const item of SEED_FOODS) {
      if (!item.peakMonths) continue;
      expect(item.seasonMonths).toBeDefined();
      for (const month of item.peakMonths) {
        expect(item.seasonMonths).toContain(month);
      }
    }
  });

  it('only records a glycemic index on foods that carry carbohydrate', () => {
    for (const item of SEED_FOODS) {
      if (item.glycemicIndex == null) continue;
      expect(item.nutrients?.carbsG ?? 0).toBeGreaterThan(0);
    }
  });

  it('marks the state of every grain and pulse, where dry vs cooked differs ~3x', () => {
    for (const item of SEED_FOODS) {
      if (item.group !== 'grain' && item.group !== 'legume') continue;
      if (!item.nutrients) continue;
      // Bread is neither dry nor cooked in the useful sense; everything else must say.
      if (item.slug === 'wholemeal-bread') continue;
      expect(item.nutrients.state).toBeDefined();
    }
  });
});
