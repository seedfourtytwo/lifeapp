import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  isFoodInPeakSeason,
  isFoodInSeason,
  isPlantFood,
  type FoodItem,
} from '../../protocol';
import { FOOD_GROUP_ICONS } from './foodGroupIcons';

type Props = {
  item: FoodItem;
  name: string;
  /** 1-based calendar month, for the in-season marker. */
  month: number;
  logged: boolean;
  /** True when this food already counts toward the week, on any day. */
  countedThisWeek: boolean;
  /**
   * Take the item — and its current state — rather than closing over them, so
   * the parent can pass one callback that never changes identity and the memo
   * below actually holds. Passing `logged` back is what keeps the parent's
   * handler independent of the logged-today set.
   */
  onToggle: (item: FoodItem, logged: boolean) => void;
  onLongPress: (item: FoodItem) => void;
};

/** Compact per-100 summary — only the values that are actually filled in. */
function nutrientSummary(
  item: FoodItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const nutrients = item.nutrients;
  if (!nutrients) return null;
  const parts: string[] = [];
  if (nutrients.energyKcal != null) parts.push(t('nutrients.energy', { value: nutrients.energyKcal }));
  if (nutrients.proteinG != null) parts.push(t('nutrients.protein', { value: nutrients.proteinG }));
  if (nutrients.carbsG != null) parts.push(t('nutrients.carbs', { value: nutrients.carbsG }));
  if (nutrients.fiberG != null) parts.push(t('nutrients.fiber', { value: nutrients.fiberG }));
  if (item.glycemicIndex != null) parts.push(t('nutrients.gi', { value: item.glycemicIndex }));
  if (parts.length === 0) return null;
  const basis = nutrients.state
    ? t('nutrients.basisWithState', {
        basis: t(`nutrients.${nutrients.basis}`),
        state: t(`states.${nutrients.state}`),
      })
    : t(`nutrients.${nutrients.basis}`);
  return `${parts.join(' · ')} — ${basis}`;
}

function FoodRow({
  item,
  name,
  month,
  logged,
  countedThisWeek,
  onToggle,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');
  const plant = isPlantFood(item);
  const summary = nutrientSummary(item, t);
  const inSeason = isFoodInSeason(item, month);
  const peak = isFoodInPeakSeason(item, month);

  return (
    <Pressable
      onPress={() => onToggle(item, logged)}
      onLongPress={() => onLongPress(item)}
      style={[
        styles.row,
        {
          backgroundColor: logged ? theme.colors.secondaryContainer : theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: logged }}
      accessibilityLabel={logged ? t('list.a11yToggleOff', { name }) : t('list.a11yToggleOn', { name })}
    >
      <MaterialCommunityIcons
        name={FOOD_GROUP_ICONS[item.group]}
        size={22}
        color={plant ? theme.colors.primary : theme.colors.onSurfaceVariant}
      />

      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text
            variant="bodyLarge"
            numberOfLines={1}
            style={[
              styles.name,
              { color: logged ? theme.colors.onSecondaryContainer : theme.colors.onSurface },
            ]}
          >
            {name}
          </Text>
          {inSeason ? (
            <MaterialCommunityIcons
              name={peak ? 'leaf' : 'leaf-maple'}
              size={14}
              color={peak ? theme.colors.primary : theme.colors.onSurfaceVariant}
              accessibilityLabel={peak ? t('season.peak') : t('season.inSeason')}
            />
          ) : null}
        </View>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {summary ?? t(`groups.${item.group}`)}
        </Text>
      </View>

      {/* Dimmed check means "already counted this week, just not on this day". */}
      <MaterialCommunityIcons
        name={logged ? 'check-circle' : countedThisWeek ? 'check-circle-outline' : 'plus'}
        size={22}
        color={
          logged
            ? theme.colors.primary
            : countedThisWeek
              ? theme.colors.onSurfaceDisabled
              : theme.colors.onSurfaceVariant
        }
      />
    </Pressable>
  );
}

/**
 * The catalog list re-renders on every keystroke and every log tap. Memoising
 * keeps that to the rows whose own state actually changed.
 */
export default React.memo(FoodRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
});
