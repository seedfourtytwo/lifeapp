import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import IconPickerField from '../../components/trackerEditor/IconPickerField';
import {
  JOURNAL_NOTEBOOK_COLORS,
  JOURNAL_NOTEBOOK_MAX,
  JOURNAL_NOTEBOOK_NAME_MAX,
  type JournalNotebook,
  type JournalNotebookColor,
  type TrackerIconId,
} from '../../protocol';
import {
  createJournalNotebook,
  deleteJournalNotebook,
  moveJournalNotebook,
  suggestedNotebookColor,
  updateJournalNotebook,
} from '../../notes/journalNotebooks';

type Props = {
  notebooks: JournalNotebook[];
  onChanged: () => void;
};

type Draft = {
  id: string | 'new';
  name: string;
  color: JournalNotebookColor;
  icon?: TrackerIconId;
};

export default function JournalNotebooksSection({ notebooks, onChanged }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const canAdd = notebooks.length < JOURNAL_NOTEBOOK_MAX;

  const startNew = () => {
    setDraft({
      id: 'new',
      name: '',
      color: suggestedNotebookColor(notebooks),
    });
  };

  const startEdit = (notebook: JournalNotebook) => {
    setDraft({
      id: notebook.id,
      name: notebook.name,
      color: notebook.color,
      icon: notebook.icon,
    });
  };

  const save = async () => {
    if (!draft || busy) return;
    const name = draft.name.trim();
    if (!name) {
      Alert.alert(t('notebooks.nameRequiredTitle'), t('notebooks.nameRequiredBody'));
      return;
    }
    setBusy(true);
    try {
      if (draft.id === 'new') {
        await createJournalNotebook({ name, color: draft.color, icon: draft.icon });
      } else {
        await updateJournalNotebook(draft.id, {
          name,
          color: draft.color,
          icon: draft.icon,
        });
      }
      setDraft(null);
      onChanged();
    } catch (error) {
      Alert.alert(
        t('notebooks.couldNotSaveTitle'),
        error instanceof Error ? error.message : t('screen.couldNotLoadJournalsFallback'),
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (notebook: JournalNotebook) => {
    if (notebooks.length <= 1) {
      Alert.alert(t('notebooks.cannotDeleteLastTitle'), t('notebooks.cannotDeleteLastBody'));
      return;
    }
    Alert.alert(t('notebooks.deleteTitle', { name: notebook.name }), t('notebooks.deleteBody'), [
      { text: t('editorSheet.cancel'), style: 'cancel' },
      {
        text: t('notebooks.deleteAction'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await deleteJournalNotebook(notebook.id);
              if (draft?.id === notebook.id) setDraft(null);
              onChanged();
            } catch (error) {
              Alert.alert(
                t('notebooks.couldNotDeleteTitle'),
                error instanceof Error ? error.message : t('screen.couldNotLoadJournalsFallback'),
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleSmall">{t('notebooks.title')}</Text>
        {canAdd ? (
          <Button mode="text" compact onPress={startNew} disabled={busy || draft?.id === 'new'}>
            {t('notebooks.add')}
          </Button>
        ) : (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('notebooks.maxReached', { count: JOURNAL_NOTEBOOK_MAX })}
          </Text>
        )}
      </View>

      {notebooks.map((notebook, index) => (
        <View key={notebook.id} style={styles.row}>
          <Pressable
            onPress={() => startEdit(notebook)}
            style={styles.rowMain}
            accessibilityRole="button"
            accessibilityLabel={t('notebooks.editA11y', { name: notebook.name })}
          >
            <View style={[styles.swatch, { backgroundColor: notebook.color }]} />
            <Text variant="bodyMedium" style={styles.rowName} numberOfLines={1}>
              {notebook.name}
            </Text>
          </Pressable>
          <IconButtonLite
            name="chevron-up"
            disabled={busy || index === 0}
            onPress={() => {
              void moveJournalNotebook(notebook.id, 'up').then(onChanged);
            }}
            color={theme.colors.onSurfaceVariant}
            a11y={t('notebooks.moveUpA11y', { name: notebook.name })}
          />
          <IconButtonLite
            name="chevron-down"
            disabled={busy || index === notebooks.length - 1}
            onPress={() => {
              void moveJournalNotebook(notebook.id, 'down').then(onChanged);
            }}
            color={theme.colors.onSurfaceVariant}
            a11y={t('notebooks.moveDownA11y', { name: notebook.name })}
          />
          <IconButtonLite
            name="delete-outline"
            disabled={busy || notebooks.length <= 1}
            onPress={() => confirmDelete(notebook)}
            color={theme.colors.error}
            a11y={t('notebooks.deleteA11y', { name: notebook.name })}
          />
        </View>
      ))}

      {draft ? (
        <View style={styles.editor}>
          <TextInput
            mode="outlined"
            label={t('notebooks.nameLabel')}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            maxLength={JOURNAL_NOTEBOOK_NAME_MAX}
            autoFocus={draft.id === 'new'}
          />
          <Text variant="labelMedium" style={styles.colorLabel}>
            {t('notebooks.colorLabel')}
          </Text>
          <View style={styles.colors}>
            {JOURNAL_NOTEBOOK_COLORS.map((color) => {
              const selected = draft.color === color;
              return (
                <Pressable
                  key={color}
                  onPress={() => setDraft({ ...draft, color })}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selected && styles.colorDotSelected,
                    selected && { borderColor: theme.colors.onSurface },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('notebooks.colorA11y', { color })}
                />
              );
            })}
          </View>
          <IconPickerField
            value={draft.icon ?? null}
            onChange={(icon) => setDraft({ ...draft, icon: icon ?? undefined })}
          />
          <View style={styles.editorActions}>
            <Button mode="text" onPress={() => setDraft(null)} disabled={busy}>
              {t('editorSheet.cancel')}
            </Button>
            <Button mode="contained" onPress={() => void save()} loading={busy} disabled={busy}>
              {t('editorSheet.save')}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function IconButtonLite({
  name,
  onPress,
  disabled,
  color,
  a11y,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  color: string;
  a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[styles.iconHit, disabled && styles.iconDisabled]}
    >
      <MaterialCommunityIcons name={name} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    minHeight: 40,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  rowName: {
    flex: 1,
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: {
    opacity: 0.35,
  },
  editor: {
    gap: 8,
    paddingTop: 8,
  },
  colorLabel: {
    marginTop: 4,
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderWidth: 2,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
