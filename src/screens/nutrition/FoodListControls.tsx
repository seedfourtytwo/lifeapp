import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FOOD_GROUPS, type FoodGroup } from '../../protocol';
import {
  FOOD_SORT_KEYS,
  countActiveFoodFilters,
  DEFAULT_FOOD_FILTER,
  type FoodFilterState,
  type FoodSortKey,
} from '../../nutrition/foodFilters';
import ChoiceChip from '../../components/ChoiceChip';
import Rule from '../../components/Rule';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

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
  // The chips sit on the page, not on a sheet: an idle one takes the tile
  // colour, or it would vanish into the ground.
  const idle = { backgroundColor: theme.colors.surface };

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
              <ChoiceChip
                role="checkbox"
                label={filter.group ? t(`groups.${filter.group}`) : t('filters.allGroups')}
                selected={filter.group != null}
                onPress={() => setGroupMenu(true)}
                style={filter.group == null ? idle : undefined}
              />
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
            <Rule />
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

          <ChoiceChip
            role="checkbox"
            label={t('filters.plantsOnly')}
            selected={filter.plantsOnly}
            onPress={() => onFilterChange({ ...filter, plantsOnly: !filter.plantsOnly })}
            style={filter.plantsOnly ? undefined : idle}
          />

          <ChoiceChip
            role="checkbox"
            label={t('filters.inSeason')}
            selected={filter.inSeasonOnly}
            onPress={() => onFilterChange({ ...filter, inSeasonOnly: !filter.inSeasonOnly })}
            style={filter.inSeasonOnly ? undefined : idle}
          />

          {activeCount > 0 ? (
            <Button compact mode="text" onPress={() => onFilterChange(DEFAULT_FOOD_FILTER)}>
              {t('filters.clear')}
            </Button>
          ) : null}
        </ScrollView>

        <Menu
          visible={sortMenu}
          onDismiss={() => setSortMenu(false)}
          anchor={
            <IconButton
              icon="sort"
              size={22}
              iconColor={theme.colors.onSurfaceVariant}
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

      <Text style={[typeScale.caption, styles.count, { color: theme.colors.onSurfaceVariant }]}>
        {t('filters.resultCount', { count: resultCount })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingRight: space.xs,
    alignItems: 'center',
  },
  count: {
    paddingHorizontal: space.xs,
  },
  sortButton: {
    margin: 0,
  },
});
