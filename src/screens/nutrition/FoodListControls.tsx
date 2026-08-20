import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Divider, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FOOD_GROUPS, type FoodGroup } from '../../protocol';
import {
  FOOD_SORT_KEYS,
  countActiveFoodFilters,
  DEFAULT_FOOD_FILTER,
  type FoodFilterState,
  type FoodSortKey,
} from '../../nutrition/foodFilters';

type Props = {
  filter: FoodFilterState;
  sort: FoodSortKey;
  /** Number of rows the current filter/search leaves visible. */
  resultCount: number;
  onFilterChange: (next: FoodFilterState) => void;
  onSortChange: (next: FoodSortKey) => void;
};

/** Quick filter chips + a sort menu, sitting under the search field. */
export default function FoodListControls({
  filter,
  sort,
  resultCount,
  onFilterChange,
  onSortChange,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');
  const [groupMenu, setGroupMenu] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);

  const activeCount = countActiveFoodFilters(filter);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          <Menu
            visible={groupMenu}
            onDismiss={() => setGroupMenu(false)}
            anchor={
              <Chip
                compact
                icon="shape-outline"
                selected={filter.group != null}
                showSelectedCheck={false}
                onPress={() => setGroupMenu(true)}
              >
                {filter.group ? t(`groups.${filter.group}`) : t('filters.allGroups')}
              </Chip>
            }
          >
            <Menu.Item
              title={t('filters.allGroups')}
              leadingIcon={filter.group == null ? 'check' : undefined}
              onPress={() => {
                onFilterChange({ ...filter, group: null });
                setGroupMenu(false);
              }}
            />
            <Divider />
            {FOOD_GROUPS.map((group: FoodGroup) => (
              <Menu.Item
                key={group}
                title={t(`groups.${group}`)}
                leadingIcon={filter.group === group ? 'check' : undefined}
                onPress={() => {
                  onFilterChange({ ...filter, group });
                  setGroupMenu(false);
                }}
              />
            ))}
          </Menu>

          <Chip
            compact
            selected={filter.plantsOnly}
            showSelectedCheck={false}
            onPress={() => onFilterChange({ ...filter, plantsOnly: !filter.plantsOnly })}
          >
            {t('filters.plantsOnly')}
          </Chip>

          <Chip
            compact
            selected={filter.inSeasonOnly}
            showSelectedCheck={false}
            onPress={() => onFilterChange({ ...filter, inSeasonOnly: !filter.inSeasonOnly })}
          >
            {t('filters.inSeason')}
          </Chip>

          {activeCount > 0 ? (
            <Chip
              compact
              icon="close"
              onPress={() => onFilterChange(DEFAULT_FOOD_FILTER)}
            >
              {t('filters.clear')}
            </Chip>
          ) : null}
        </ScrollView>

        <Menu
          visible={sortMenu}
          onDismiss={() => setSortMenu(false)}
          anchor={
            <IconButton
              icon="sort"
              size={20}
              onPress={() => setSortMenu(true)}
              accessibilityLabel={t('sort.a11y', { value: t(`sort.${sort}`) })}
              style={styles.sortButton}
            />
          }
        >
          {FOOD_SORT_KEYS.map((key) => (
            <Menu.Item
              key={key}
              title={t(`sort.${key}`)}
              leadingIcon={sort === key ? 'check' : undefined}
              onPress={() => {
                onSortChange(key);
                setSortMenu(false);
              }}
            />
          ))}
        </Menu>
      </View>

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('filters.resultCount', { count: resultCount })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
    alignItems: 'center',
  },
  sortButton: {
    margin: 0,
  },
});
