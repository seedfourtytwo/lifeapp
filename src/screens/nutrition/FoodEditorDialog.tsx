import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../../components/ChoiceChip';
import QuietText from '../../components/QuietText';
import { SettingsSwitch } from '../../components/settings';
import { EditorSheet, FilledField } from '../../components/sheet';
import {
  FOOD_GROUPS,
  FOOD_NAME_MAX_LENGTH,
  isPlantFoodGroup,
  type FoodGroup,
} from '../../protocol';
import type { FoodItemInput } from '../../nutrition/foodCatalog';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

type Props = {
  visible: boolean;
  /** Prefills the name from the unmatched search text. */
  initialName?: string;
  onDismiss: () => void;
  onSave: (input: FoodItemInput) => Promise<void>;
};

/**
 * Quick add from the Nutrition screen: name and group, nothing else. Editing an
 * existing food — season, nutrients, GI, portions — happens on the full
 * Ingredients editor screen, so there is only ever one form that can change a
 * food and no risk of a partial form silently dropping fields it cannot show.
 */
export default function FoodEditorDialog({ visible, initialName, onDismiss, onSave }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');
  const [name, setName] = useState('');
  const [group, setGroup] = useState<FoodGroup>('vegetable');
  const [countsAsPlant, setCountsAsPlant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initialName ?? '');
    setGroup('vegetable');
    setCountsAsPlant(isPlantFoodGroup('vegetable'));
    setError(null);
    setSaving(false);
  }, [visible, initialName]);

  // Switching group re-applies that group's default unless the user overrode it.
  const handleGroupChange = (next: FoodGroup) => {
    setGroup(next);
    setCountsAsPlant(isPlantFoodGroup(next));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('editor.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        group,
        // Store the override only when it disagrees with the group default.
        countsAsPlant: countsAsPlant === isPlantFoodGroup(group) ? undefined : countsAsPlant,
      });
      onDismiss();
    } catch {
      setError(t('editor.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <EditorSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!saving}
      title={t('editor.addTitle')}
      primaryAction={{
        label: t('editor.save'),
        onPress: () => void handleSave(),
        disabled: saving,
        loading: saving,
      }}
    >
      <FilledField
        placeholder={t('editor.nameLabel')}
        value={name}
        onChangeText={(next) => {
          setName(next);
          setError(null);
        }}
        maxLength={FOOD_NAME_MAX_LENGTH}
        autoFocus
      />

      <View style={styles.group}>
        <QuietText style={typeScale.caption}>{t('editor.groupLabel')}</QuietText>
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('editor.groupLabel')}
        >
          {FOOD_GROUPS.map((candidate) => (
            <ChoiceChip
              key={candidate}
              label={t(`groups.${candidate}`)}
              selected={candidate === group}
              onPress={() => handleGroupChange(candidate)}
            />
          ))}
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={[typeScale.body, styles.switchLabel, { color: theme.colors.onSurface }]}>
          {t('editor.countsAsPlantLabel')}
        </Text>
        <SettingsSwitch
          value={countsAsPlant}
          onValueChange={setCountsAsPlant}
          accessibilityLabel={t('editor.countsAsPlantLabel')}
        />
      </View>

      {error ? (
        <Text style={[typeScale.caption, { color: theme.colors.error }]}>{error}</Text>
      ) : null}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 48,
  },
  switchLabel: {
    flex: 1,
    minWidth: 0,
  },
});
