import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Searchbar, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { useShallow } from 'zustand/react/shallow';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { foodDisplayName } from '../nutrition/seedCatalog';
import {
  DEFAULT_FOOD_FILTER,
  catalogHasFoodNamed,
  filterFoods,
  isFoodFilterActive,
  sortFoods,
  type FoodFilterState,
  type FoodSortKey,
  type NamedFood,
} from '../nutrition/foodFilters';
import { searchFoodItems } from '../nutrition/search';
import { computeWeekDiversity, loggedFoodIdsForDate } from '../nutrition/weekDiversity';
import type { FoodItemInput } from '../nutrition/foodCatalog';
import type { RootStackParamList } from '../navigation/types';
import type { FoodItem } from '../protocol';
import { activeFoodItems, useFoodStore } from '../store/foodStore';
import { getDateLocale } from '../i18n';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { weekDates } from '../utils/dates';
import FoodEditorDialog from './nutrition/FoodEditorDialog';
import FoodListControls from './nutrition/FoodListControls';
import FoodRow from './nutrition/FoodRow';
import WeekDayStrip from './nutrition/WeekDayStrip';
import WeekPlantProgress from './nutrition/WeekPlantProgress';
import DayHeader from './shared/DayHeader';
import { HomeTabScrollView } from './shared/HomeTabScrollView';
import { homeTabScreenStyles } from './shared/screenStyles';

/** A short query can match most of the catalog; cap what actually mounts. */
const SEARCH_RESULT_LIMIT = 50;

/**
 * Home Nutrition tab. Shows this week's plate, not the catalogue: the default
 * list is only what has been logged this week, and searching reaches into the
 * full catalogue to add something new. That keeps the rendered set small by
 * design — the catalogue itself is browsed and edited under More → Ingredients.
 *
 * Quantities and intake maths are deliberately not here yet; this answers
 * "did I eat enough different plants".
 */
function NutritionScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation('nutrition');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const now = useAppCalendarNow();
  const today = currentAppCalendarDate(now);

  const { items, weekEntries, loaded, loading, error, loadWeek, weekStart, toggleLogged, create } =
    useFoodStore(
      useShallow((s) => ({
        items: s.items,
        weekEntries: s.weekEntries,
        loaded: s.loaded,
        loading: s.loading,
        error: s.error,
        loadWeek: s.loadWeek,
        weekStart: s.weekStart,
        toggleLogged: s.toggleLogged,
        create: s.create,
      })),
    );

  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FoodFilterState>(DEFAULT_FOOD_FILTER);
  const [sort, setSort] = useState<FoodSortKey>('name');
  const [addOpen, setAddOpen] = useState(false);

  const dates = useMemo(() => weekDates(today), [today]);

  useEffect(() => {
    void loadWeek(today);
  }, [loadWeek, today]);

  // Day rollover (possibly into a new week) must not strand the selection in the past.
  useEffect(() => {
    setSelectedDate((current) => (dates.includes(current) && current <= today ? current : today));
  }, [dates, today]);

  const diversity = useMemo(
    () => computeWeekDiversity(items, weekEntries),
    [items, weekEntries],
  );

  const loggedToday = useMemo(
    () => loggedFoodIdsForDate(weekEntries, selectedDate),
    [weekEntries, selectedDate],
  );

  const loggedDates = useMemo(
    () => new Set(weekEntries.map((entry) => entry.date)),
    [weekEntries],
  );

  /** 1-based month of the day being logged — drives the in-season marker. */
  const month = Number(selectedDate.slice(5, 7));

  const language = i18n.language;
  const trimmedQuery = query.trim();

  /** Archived foods still count for the week but must not clutter the list. */
  const catalog = useMemo(() => activeFoodItems(items), [items]);

  const named = useMemo<NamedFood[]>(
    () => catalog.map((item) => ({ item, name: foodDisplayName(item, language) })),
    [catalog, language],
  );

  /**
   * Rows that have appeared in this week's list while the screen has been open.
   * Without this, un-ticking a food you only ate today would make its row vanish
   * from under your finger — you could not change your mind without searching
   * for it again. Reset when the week changes.
   */
  const stickyIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    stickyIds.current = new Set();
  }, [weekStart]);
  // Accumulated in an effect, not during render: mutating a ref while rendering
  // is a side effect, and the memo below reads the live set directly anyway, so
  // this only has to remember foods that have since been un-ticked.
  useEffect(() => {
    for (const id of diversity.loggedFoodIds) stickyIds.current.add(id);
  }, [diversity.loggedFoodIds]);

  const searching = trimmedQuery.length > 0;

  const visible = useMemo(() => {
    if (searching) {
      // Searching looks at the whole catalog — this is how foods get added to
      // the week. Relevance beats the chosen sort, and the result set is capped
      // so a one-letter query cannot mount the entire catalog.
      const filtered = filterFoods(named, filter, { month });
      const byId = new Map(filtered.map((entry) => [entry.item.id, entry]));
      return searchFoodItems(
        filtered.map((entry) => entry.item),
        query,
      )
        .slice(0, SEARCH_RESULT_LIMIT)
        .flatMap((item) => {
          const entry = byId.get(item.id);
          return entry ? [entry] : [];
        });
    }

    // Default view: only what is on this week's plate, never the whole catalog.
    // The sticky set keeps a row you just un-ticked from vanishing under you.
    const week = filterFoods(
      named.filter(
        (entry) =>
          diversity.loggedFoodIds.has(entry.item.id) || stickyIds.current.has(entry.item.id),
      ),
      filter,
      { month },
    );
    const sorted = sortFoods(week, sort, { month }, getDateLocale());
    // What you ate on the selected day floats to the top.
    return [
      ...sorted.filter((entry) => loggedToday.has(entry.item.id)),
      ...sorted.filter((entry) => !loggedToday.has(entry.item.id)),
    ];
  }, [searching, named, filter, month, query, sort, loggedToday, diversity.loggedFoodIds]);

  const searchTruncated = searching && visible.length >= SEARCH_RESULT_LIMIT;

  // Deliberately not dependent on `loggedToday`: that set changes on every tap,
  // which would change this callback's identity and re-render every row instead
  // of just the one that toggled. The row reports its own state back.
  const handleToggle = useCallback(
    (item: FoodItem, logged: boolean) => {
      void toggleLogged({ foodId: item.id, date: selectedDate, logged: !logged });
    },
    [toggleLogged, selectedDate],
  );

  const openIngredients = useCallback(
    () => navigation.navigate('Ingredients'),
    [navigation],
  );

  /** Full editing lives on the Ingredients screen — one form owns every field. */
  const openIngredientEditor = useCallback(
    (item: FoodItem) => navigation.navigate('IngredientEditor', { foodId: item.id }),
    [navigation],
  );

  const handleCreate = async (input: FoodItemInput) => {
    const item = await create(input);
    setQuery('');
    // No item means a clear/import discarded the write — there is nothing to log.
    if (!item) return;
    // A food you just added is almost certainly one you just ate. This must not
    // throw: the food already exists, and surfacing a failure here would invite
    // a retry that creates a duplicate. The tap is trivially repeatable instead.
    try {
      await toggleLogged({ foodId: item.id, date: selectedDate, logged: true });
    } catch (error) {
      console.warn('Food created but could not be logged', error);
    }
  };

  const showAddFromQuery = useMemo(
    () => trimmedQuery.length > 0 && !catalogHasFoodNamed(named, items, trimmedQuery),
    [trimmedQuery, named, items],
  );

  if (!loaded && loading) {
    return (
      <View style={homeTabScreenStyles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <HomeTabScrollView
        contentContainerStyle={homeTabScreenStyles.container}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.error, marginBottom: 12 }}>
            {t('errors.loadFailed')}
          </Text>
        ) : null}

        <DayHeader now={now} />

        <WeekPlantProgress diversity={diversity} />

        <WeekDayStrip
          dates={dates}
          selectedDate={selectedDate}
          today={today}
          loggedDates={loggedDates}
          onSelect={setSelectedDate}
        />

        <Searchbar
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          style={styles.search}
          inputStyle={styles.searchInput}
        />

        {catalog.length === 0 ? (
          <View style={styles.emptyWrap}>
            <QuietText variant="bodyMedium" style={homeTabScreenStyles.empty}>
              {t('list.emptyCatalog')}
            </QuietText>
            <Button mode="contained-tonal" icon="playlist-plus" onPress={openIngredients}>
              {t('list.openIngredients')}
            </Button>
          </View>
        ) : null}

        {catalog.length > 0 && visible.length > 0 ? (
          <FoodListControls
            filter={filter}
            sort={sort}
            resultCount={visible.length}
            onFilterChange={setFilter}
            onSortChange={setSort}
          />
        ) : null}

        {catalog.length > 0 && visible.length === 0 && !searching ? (
          <QuietText variant="bodyMedium" style={homeTabScreenStyles.empty}>
            {isFoodFilterActive(filter) ? t('filters.noMatches') : t('list.emptyWeek')}
          </QuietText>
        ) : null}

        {visible.map(({ item, name }) => (
          <FoodRow
            key={item.id}
            item={item}
            name={name}
            month={month}
            logged={loggedToday.has(item.id)}
            countedThisWeek={diversity.loggedFoodIds.has(item.id)}
            onToggle={handleToggle}
            onLongPress={openIngredientEditor}
          />
        ))}

        {searchTruncated ? (
          <QuietText variant="bodySmall" style={homeTabScreenStyles.empty}>
            {t('search.tooMany', { count: SEARCH_RESULT_LIMIT })}
          </QuietText>
        ) : null}

        {showAddFromQuery ? (
          <View style={styles.addWrap}>
            {visible.length === 0 ? (
              <QuietText variant="bodyMedium" style={homeTabScreenStyles.empty}>
                {t('search.noResults', { query: trimmedQuery })}
              </QuietText>
            ) : null}
            <Button mode="contained-tonal" icon="plus" onPress={() => setAddOpen(true)}>
              {t('search.addNamed', { query: trimmedQuery })}
            </Button>
          </View>
        ) : null}
      </HomeTabScrollView>

      <FoodEditorDialog
        visible={addOpen}
        initialName={trimmedQuery}
        onDismiss={() => setAddOpen(false)}
        onSave={handleCreate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: 12,
  },
  searchInput: {
    minHeight: 0,
  },
  addWrap: {
    marginTop: 8,
    gap: 12,
  },
  emptyWrap: {
    marginTop: 24,
    gap: 16,
    alignItems: 'center',
  },
});

/**
 * Memoised because it takes no props: a Home tab change re-renders HomeScreen,
 * and this page has no reason to follow it.
 */
export default memo(NutritionScreen);
