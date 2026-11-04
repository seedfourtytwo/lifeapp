import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/types';
import {
  FOOD_GROUPS,
  FOOD_NAME_MAX_LENGTH,
  FOOD_PORTION_MAX,
  FOOD_STATES,
  isPlantFoodGroup,
  type FoodGroup,
  type FoodState,
} from '../protocol';
import { foodDisplayName } from '../nutrition/seedCatalog';
import { useFoodStore } from '../store/foodStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import {
  NUMERIC_NUTRIENT_FIELDS,
  draftFromItem,
  draftToInput,
  type DraftError,
  type IngredientDraft,
  type NumericNutrientField,
} from './nutrition/ingredientEditorState';
import MonthPicker from './nutrition/MonthPicker';
import ChoiceChip from '../components/ChoiceChip';
import SegmentedControl from '../components/SegmentedControl';
import SettingsSwitch from '../components/settings/SettingsSwitch';
import FilledField from '../components/sheet/FilledField';
import { useAppTheme } from '../hooks/useAppTheme';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'IngredientEditor'>;

function draftErrorMessage(
  error: DraftError,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (error.kind) {
    case 'nameRequired':
      return t('editor.nameRequired');
    case 'portionIncomplete':
      return t('editor.portionIncomplete');
    case 'sugarsAboveCarbs':
      return t('editor.sugarsAboveCarbs');
    case 'satFatAboveFat':
      return t('editor.satFatAboveFat');
    case 'notANumber':
      return t('editor.notANumber', { field: t(`fields.${error.field}`) });
  }
}

function toggleMonth(months: readonly number[], month: number): number[] {
  return months.includes(month)
    ? months.filter((value) => value !== month)
    : [...months, month].sort((a, b) => a - b);
}

/**
 * Full ingredient form — every field on the standard, all optional but name and
 * group. Remounted per food via the navigator's `getId`, so the initial draft
 * stays in sync with route params.
 */
export default function IngredientEditorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { t, i18n } = useTranslation('nutrition');
  const { t: tCommon } = useTranslation('common');
  const foodId = route.params?.foodId;

  const items = useFoodStore((s) => s.items);
  const loaded = useFoodStore((s) => s.loaded);
  const loadWeek = useFoodStore((s) => s.loadWeek);
  const create = useFoodStore((s) => s.create);
  const update = useFoodStore((s) => s.update);
  const remove = useFoodStore((s) => s.remove);

  const existing = useMemo(
    () => (foodId ? items.find((item) => item.id === foodId) : undefined),
    [foodId, items],
  );

  const [draft, setDraft] = useState<IngredientDraft>(() => draftFromItem(existing));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** False until the draft reflects the food being edited. */
  const [seeded, setSeeded] = useState(() => !foodId || existing != null);

  // Android can restore this screen after the process was killed, before the
  // catalog has loaded. Without this the form would sit blank and saving would
  // create a duplicate instead of editing the food.
  useEffect(() => {
    if (!loaded) void loadWeek(currentAppCalendarDate());
  }, [loaded, loadWeek]);

  useEffect(() => {
    if (seeded || !existing) return;
    setDraft(draftFromItem(existing));
    setSeeded(true);
  }, [seeded, existing]);

  // The food was removed while this screen was backgrounded — nothing to edit.
  useEffect(() => {
    if (seeded || !loaded || !foodId || existing) return;
    navigation.goBack();
  }, [seeded, loaded, foodId, existing, navigation]);

  const set = useCallback(
    <K extends keyof IngredientDraft>(key: K, value: IngredientDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setError(null);
    },
    [],
  );

  const handleGroupChange = useCallback((group: FoodGroup) => {
    setDraft((current) => ({
      ...current,
      group,
      // Re-apply the group default; the switch below can still override it.
      countsAsPlant: isPlantFoodGroup(group),
    }));
    setError(null);
  }, []);

  /**
   * Season and peak toggles. Both read the previous draft inside the updater
   * rather than closing over it, so they stay referentially stable and
   * MonthPicker's memo actually holds.
   */
  const handleSeasonToggle = useCallback((month: number) => {
    setDraft((current) => {
      const seasonMonths = toggleMonth(current.seasonMonths, month);
      return {
        ...current,
        seasonMonths,
        // Peak can never sit outside the season.
        peakMonths: current.peakMonths.filter((value) => seasonMonths.includes(value)),
      };
    });
    setError(null);
  }, []);

  const handlePeakToggle = useCallback((month: number) => {
    setDraft((current) => ({
      ...current,
      peakMonths: toggleMonth(current.peakMonths, month),
    }));
    setError(null);
  }, []);

  const handleSave = async () => {
    // Guard the same race: saving a blank draft would create a second food.
    if (!seeded) return;
    const result = draftToInput(draft);
    if (!result.ok) {
      setError(draftErrorMessage(result.error, t));
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await update(existing.id, result.input);
      } else {
        await create(result.input);
      }
      navigation.goBack();
    } catch (saveError) {
      // Zod cross-field rules land here (sugars above carbs, peak outside season).
      setError(
        saveError instanceof Error ? saveError.message : t('editor.saveFailed'),
      );
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      // The stored name is the English one for seed foods — show what the user sees.
      t('remove.confirmTitle', { name: foodDisplayName(existing, i18n.language) }),
      t('remove.confirmBody'),
      [
        { text: tCommon('actions.cancel'), style: 'cancel' },
        {
          text: t('remove.action'),
          style: 'destructive',
          onPress: () => {
            void remove(existing.id)
              .then((result) => {
                if (result === 'archived') {
                  Alert.alert(t('remove.archivedTitle'), t('remove.archivedBody'));
                }
                navigation.goBack();
              })
              .catch(() => Alert.alert(t('remove.failed')));
          },
        },
      ],
    );
  };

  const numericLabel = (field: NumericNutrientField) => t(`fields.${field}`);

  if (!seeded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const heading = [typeScale.rowName, { color: theme.colors.onSurface }];
  const hint = [typeScale.caption, { color: theme.colors.onSurfaceVariant }];
  const tile = [styles.tile, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={tile}>
        <FilledField
          label={t('editor.nameLabel')}
          value={draft.name}
          onChangeText={(value) => set('name', value)}
          maxLength={FOOD_NAME_MAX_LENGTH}
          autoFocus={!existing}
        />

        <Text style={heading}>{t('editor.groupLabel')}</Text>
        <View style={styles.chipWrap}>
          {FOOD_GROUPS.map((group) => (
            <ChoiceChip
              key={group}
              label={t(`groups.${group}`)}
              selected={group === draft.group}
              onPress={() => handleGroupChange(group)}
            />
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={heading}>{t('editor.countsAsPlantLabel')}</Text>
            <Text style={hint}>{t('editor.countsAsPlantHint')}</Text>
          </View>
          <SettingsSwitch
            value={draft.countsAsPlant}
            onValueChange={(value) => set('countsAsPlant', value)}
            accessibilityLabel={t('editor.countsAsPlantLabel')}
          />
        </View>
      </View>

      <View style={tile}>
        <Text style={heading}>{t('editor.seasonLabel')}</Text>
        <Text style={hint}>{t('editor.seasonHint')}</Text>
        <MonthPicker
          label={t('editor.seasonLabel')}
          selected={draft.seasonMonths}
          onToggle={handleSeasonToggle}
        />

        {draft.seasonMonths.length > 0 ? (
          <>
            <Text style={[heading, styles.subLabel]}>{t('editor.peakLabel')}</Text>
            <MonthPicker
              label={t('editor.peakLabel')}
              selected={draft.peakMonths}
              allowed={draft.seasonMonths}
              onToggle={handlePeakToggle}
            />
          </>
        ) : null}
      </View>

      <View style={tile}>
        <Text style={heading}>{t('editor.nutritionLabel')}</Text>
        <Text style={hint}>{t('editor.carbsHint')}</Text>

        <SegmentedControl
          value={draft.basis}
          onChange={(value) => set('basis', value)}
          options={[
            { value: 'per100g', label: t('nutrients.per100g') },
            { value: 'per100ml', label: t('nutrients.per100ml') },
          ]}
        />

        <SegmentedControl<FoodState | 'none'>
          value={draft.state}
          onChange={(value) => set('state', value)}
          options={[
            { value: 'none', label: t('states.unset') },
            ...FOOD_STATES.map((state) => ({ value: state, label: t(`states.${state}`) })),
          ]}
        />

        <View style={styles.grid}>
          {NUMERIC_NUTRIENT_FIELDS.map((field) => (
            <FilledField
              key={field}
              label={numericLabel(field)}
              value={draft[field]}
              onChangeText={(value) => set(field, value)}
              keyboardType="decimal-pad"
              style={styles.gridItem}
            />
          ))}
        </View>

        <FilledField
          label={t('fields.glycemicIndex')}
          value={draft.glycemicIndex}
          onChangeText={(value) => set('glycemicIndex', value)}
          keyboardType="decimal-pad"
        />
        <Text style={hint}>{t('editor.giHint')}</Text>
      </View>

      <View style={tile}>
        <Text style={heading}>{t('editor.portionsLabel')}</Text>
        <Text style={hint}>{t('editor.portionsHint')}</Text>
        {draft.portions.map((portion, index) => (
          <View key={index} style={styles.portionRow}>
            <FilledField
              placeholder={t('fields.portionLabel')}
              value={portion.label}
              onChangeText={(value) =>
                set(
                  'portions',
                  draft.portions.map((entry, i) =>
                    i === index ? { ...entry, label: value } : entry,
                  ),
                )
              }
              style={styles.portionLabel}
            />
            <FilledField
              placeholder={t('fields.portionGrams')}
              value={portion.grams}
              onChangeText={(value) =>
                set(
                  'portions',
                  draft.portions.map((entry, i) =>
                    i === index ? { ...entry, grams: value } : entry,
                  ),
                )
              }
              keyboardType="decimal-pad"
              style={styles.portionGrams}
            />
            <IconButton
              icon="close"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() =>
                set(
                  'portions',
                  draft.portions.filter((_, i) => i !== index),
                )
              }
              accessibilityLabel={tCommon('actions.delete')}
            />
          </View>
        ))}
        {draft.portions.length < FOOD_PORTION_MAX ? (
          <Button
            icon="plus"
            mode="text"
            onPress={() => set('portions', [...draft.portions, { label: '', grams: '' }])}
            style={styles.inlineButton}
          >
            {t('editor.addPortion')}
          </Button>
        ) : null}
      </View>

      <View style={tile}>
        <Text style={heading}>{t('editor.matchingLabel')}</Text>
        <FilledField
          label={t('fields.aliases')}
          value={draft.aliases}
          onChangeText={(value) => set('aliases', value)}
        />
        <Text style={hint}>{t('editor.aliasesHint')}</Text>
        <FilledField
          label={t('fields.diversityKey')}
          value={draft.diversityKey}
          onChangeText={(value) => set('diversityKey', value)}
          autoCapitalize="none"
        />
        <Text style={hint}>{t('editor.diversityKeyHint')}</Text>
      </View>

      {error ? (
        <Text style={[typeScale.secondary, { color: theme.colors.error }]}>{error}</Text>
      ) : null}

      <View style={styles.footer}>
        {existing ? (
          <IconButton
            icon="delete-outline"
            size={24}
            iconColor={theme.colors.error}
            onPress={handleDelete}
            accessibilityLabel={t('remove.action')}
          />
        ) : (
          <View />
        )}
        <Button
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
          style={[styles.save, { borderRadius: deco.radius.pill }]}
          contentStyle={styles.saveContent}
          labelStyle={styles.saveLabel}
        >
          {t('editor.save')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  tile: {
    padding: space.lg,
    gap: space.md,
  },
  subLabel: {
    marginTop: space.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  switchLabel: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  portionLabel: {
    flex: 2,
  },
  portionGrams: {
    flex: 1,
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
  },
  save: {
    minWidth: 132,
  },
  saveContent: {
    minHeight: 52,
  },
  saveLabel: {
    ...typeScale.rowName,
  },
});
