import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Searchbar, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import SettingsRow from '../components/settings/SettingsRow';
import { getDateLocale } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { sortFoods, type NamedFood } from '../nutrition/foodFilters';
import { searchFoodItems } from '../nutrition/search';
import { foodDisplayName } from '../nutrition/seedCatalog';
import { isPlantFood, type FoodItem } from '../protocol';
import { useFoodStore } from '../store/foodStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { FOOD_GROUP_ICONS } from './nutrition/foodGroupIcons';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The catalogue is browsed in full here, so it is the one list that must stay
 * virtualised. Section headings are rows rather than wrappers, which keeps it a
 * single flat FlatList instead of nested scrollers.
 */
type Row =
  | { kind: 'header'; id: string; section: 'active' | 'archived'; count: number }
  | { kind: 'food'; id: string; entry: NamedFood; archived?: boolean };

/** Compact secondary line: group, plus whatever detail is already filled in. */
function summarize(item: FoodItem, t: Translate): string {
  const parts = [t(`groups.${item.group}`)];
  if (item.nutrients?.energyKcal != null) {
    parts.push(t('nutrients.energy', { value: item.nutrients.energyKcal }));
  }
  if (item.seasonMonths?.length) {
    parts.push(t('manage.seasonCount', { count: item.seasonMonths.length }));
  }
  if (item.glycemicIndex != null) {
    parts.push(t('nutrients.gi', { value: item.glycemicIndex }));
  }
  return parts.join(' · ');
}

/** Manage the food catalog: browse, search, add, edit, remove. */
export default function IngredientsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation('nutrition');
  const { t: tCommon } = useTranslation('common');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { items, loaded, loading, loadWeek, restore } = useFoodStore(
    useShallow((s) => ({
      items: s.items,
      loaded: s.loaded,
      loading: s.loading,
      loadWeek: s.loadWeek,
      restore: s.restore,
    })),
  );

  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadWeek(currentAppCalendarDate());
  }, [loadWeek]);

  const language = i18n.language;
  const month = new Date().getMonth() + 1;

  const { rows, activeCount, archivedCount } = useMemo(() => {
    const named: NamedFood[] = items.map((item) => ({
      item,
      name: foodDisplayName(item, language),
    }));
    const matched = query.trim()
      ? (() => {
          const rank = new Map(
            searchFoodItems(
              named.map((entry) => entry.item),
              query,
            ).map((item, index) => [item.id, index]),
          );
          return named
            .filter((entry) => rank.has(entry.item.id))
            .sort((a, b) => (rank.get(a.item.id) ?? 0) - (rank.get(b.item.id) ?? 0));
        })()
      : sortFoods(named, 'group', { month }, getDateLocale());
    const active = matched.filter((entry) => entry.item.archivedAt == null);
    const archived = matched.filter((entry) => entry.item.archivedAt != null);

    const list: Row[] = [];
    if (active.length > 0) {
      list.push({ kind: 'header', id: 'h-active', section: 'active', count: active.length });
      for (const entry of active) list.push({ kind: 'food', id: entry.item.id, entry });
    }
    if (archived.length > 0) {
      list.push({ kind: 'header', id: 'h-archived', section: 'archived', count: archived.length });
      for (const entry of archived) {
        list.push({ kind: 'food', id: entry.item.id, entry, archived: true });
      }
    }
    return { rows: list, activeCount: active.length, archivedCount: archived.length };
  }, [items, language, query, month]);

  if (!loaded && loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const openEditor = (foodId?: string) =>
    navigation.navigate('IngredientEditor', foodId ? { foodId } : {});

  const handleRestore = (id: string) => {
    void restore(id).catch(() => Alert.alert(tCommon('errors.somethingWentWrong')));
  };

  /**
   * A JSX *element*, not an inline component. Passing `() => <View/>` here would
   * give the header a new component type every render and remount the search
   * field, dropping focus on each keystroke.
   */
  const header = (
    <View style={styles.headerWrap}>
      <Searchbar
        value={query}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        inputStyle={styles.searchInput}
      />
      <Button mode="contained-tonal" icon="plus" onPress={() => openEditor()}>
        {t('manage.addAction')}
      </Button>
      {activeCount > 0 ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('manage.catalogCaption')}
        </Text>
      ) : null}
    </View>
  );

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'header') {
      return (
        <Text
          variant="labelLarge"
          style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}
        >
          {row.section === 'active'
            ? t('manage.catalogTitle', { count: row.count })
            : t('manage.archivedTitle', { count: row.count })}
        </Text>
      );
    }

    const { item, name } = row.entry;
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <SettingsRow
          icon={row.archived ? 'archive-outline' : FOOD_GROUP_ICONS[item.group]}
          iconColor={
            !row.archived && isPlantFood(item) ? theme.colors.onPrimaryContainer : undefined
          }
          title={name}
          description={summarize(item, t)}
          chevron={!row.archived}
          trailing={
            row.archived ? (
              <Button compact onPress={() => handleRestore(item.id)}>
                {tCommon('actions.restore')}
              </Button>
            ) : undefined
          }
          onPress={() => openEditor(item.id)}
        />
      </View>
    );
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={renderRow}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text
          variant="bodyMedium"
          style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}
        >
          {query.trim()
            ? t('search.noResults', { query: query.trim() })
            : t('manage.emptyCatalog')}
        </Text>
      }
      ListFooterComponent={
        archivedCount > 0 ? (
          <Text
            variant="bodySmall"
            style={[styles.caption, { color: theme.colors.onSurfaceVariant }]}
          >
            {t('manage.archivedCaption')}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    paddingBottom: 32,
  },
  headerWrap: {
    gap: 12,
    paddingBottom: 8,
  },
  sectionHeader: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 6,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  caption: {
    paddingHorizontal: 8,
    paddingTop: 8,
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    minHeight: 0,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
});
