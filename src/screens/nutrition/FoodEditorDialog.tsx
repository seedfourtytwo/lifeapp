import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  FOOD_GROUPS,
  FOOD_NAME_MAX_LENGTH,
  isPlantFoodGroup,
  type FoodGroup,
} from '../../protocol';
import type { FoodItemInput } from '../../nutrition/foodCatalog';

type Props = {
  visible: boolean;
  /** Prefills the name from the unmatched search text. */
  initialName?: string;
  onDismiss: () => void;
  onSave: (input: FoodItemInput) => Promise<void>;
};

/**
 * Quick add from the Nutrition tab: name and group, nothing else. Editing an
 * existing food — season, nutrients, GI, portions — happens on the full
 * Ingredients editor screen, so there is only ever one form that can change a
 * food and no risk of a partial form silently dropping fields it cannot show.
 */
export default function FoodEditorDialog({ visible, initialName, onDismiss, onSave }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('nutrition');
  const { t: tCommon } = useTranslation('common');
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
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('editor.addTitle')}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            label={t('editor.nameLabel')}
            value={name}
            onChangeText={(next) => {
              setName(next);
              setError(null);
            }}
            maxLength={FOOD_NAME_MAX_LENGTH}
            autoFocus
            mode="outlined"
          />

          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('editor.groupLabel')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.groupRow}>
              {FOOD_GROUPS.map((candidate) => (
                <Chip
                  key={candidate}
                  selected={candidate === group}
                  showSelectedCheck={false}
                  onPress={() => handleGroupChange(candidate)}
                  compact
                >
                  {t(`groups.${candidate}`)}
                </Chip>
              ))}
            </View>
          </ScrollView>

          <View style={styles.switchRow}>
            <Text variant="bodyMedium" style={styles.switchLabel}>
              {t('editor.countsAsPlantLabel')}
            </Text>
            <Switch value={countsAsPlant} onValueChange={setCountsAsPlant} />
          </View>

          {error ? (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              {error}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{tCommon('actions.cancel')}</Button>
          <Button onPress={handleSave} disabled={saving}>
            {t('editor.save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  groupRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    minWidth: 0,
  },
});
