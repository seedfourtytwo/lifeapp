import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Divider, Menu, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import IconPickerField from '../../components/trackerEditor/IconPickerField';
import { TrackerIcon } from '../../components/trackerIcons/TrackerIcon';
import { useAppTheme } from '../../hooks/useAppTheme';
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

function NotebookWell({ notebook }: { notebook: Pick<JournalNotebook, 'color' | 'icon'> }) {
  const { decorations: deco, isCartoon } = useAppTheme();
  return (
    <View
      style={[
        styles.well,
        {
          backgroundColor: `${notebook.color}33`,
          borderRadius: isCartoon ? deco.radius.sm : 12,
        },
      ]}
    >
      {notebook.icon ? (
        <TrackerIcon name={notebook.icon} size={22} color={notebook.color} />
      ) : (
        <MaterialCommunityIcons name="notebook-outline" size={22} color={notebook.color} />
      )}
    </View>
  );
}

export default function JournalNotebooksSection({ notebooks, onChanged }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco, isCartoon } = useAppTheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
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
    <View style={styles.wrap}>
      <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('notebooks.title')}
      </Text>
      <Surface
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            borderRadius: deco.radius.md,
            borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
          },
        ]}
        elevation={0}
      >
        <View style={styles.header}>
          {!canAdd ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
              {t('notebooks.maxReached', { count: JOURNAL_NOTEBOOK_MAX })}
            </Text>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {canAdd ? (
            <Pressable
              onPress={startNew}
              disabled={busy || draft?.id === 'new'}
              accessibilityRole="button"
              accessibilityLabel={t('notebooks.add')}
              hitSlop={8}
              style={styles.headerAction}
            >
              <MaterialCommunityIcons name="plus" size={22} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {notebooks.map((notebook, index) => (
          <React.Fragment key={notebook.id}>
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            <View style={styles.row}>
              <Pressable
                onPress={() => startEdit(notebook)}
                style={styles.rowMain}
                accessibilityRole="button"
                accessibilityLabel={t('notebooks.editA11y', { name: notebook.name })}
              >
                <NotebookWell notebook={notebook} />
                <Text variant="titleMedium" style={styles.rowName} numberOfLines={1}>
                  {notebook.name}
                </Text>
              </Pressable>
              <Menu
                visible={menuId === notebook.id}
                onDismiss={() => setMenuId(null)}
                anchor={
                  <Pressable
                    onPress={() => setMenuId(notebook.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('notebooks.moreA11y', { name: notebook.name })}
                    hitSlop={8}
                    style={styles.headerAction}
                  >
                    <MaterialCommunityIcons
                      name="dots-vertical"
                      size={22}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </Pressable>
                }
              >
                <Menu.Item
                  leadingIcon="chevron-up"
                  title={t('notebooks.moveUp')}
                  disabled={busy || index === 0}
                  onPress={() => {
                    setMenuId(null);
                    void moveJournalNotebook(notebook.id, 'up').then(onChanged);
                  }}
                />
                <Menu.Item
                  leadingIcon="chevron-down"
                  title={t('notebooks.moveDown')}
                  disabled={busy || index === notebooks.length - 1}
                  onPress={() => {
                    setMenuId(null);
                    void moveJournalNotebook(notebook.id, 'down').then(onChanged);
                  }}
                />
                <Menu.Item
                  leadingIcon="delete-outline"
                  title={t('notebooks.deleteAction')}
                  disabled={busy || notebooks.length <= 1}
                  onPress={() => {
                    setMenuId(null);
                    confirmDelete(notebook);
                  }}
                />
              </Menu>
            </View>
          </React.Fragment>
        ))}

        {draft ? (
          <>
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            <View style={styles.editor}>
              <TextInput
                mode="outlined"
                label={t('notebooks.nameLabel')}
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                maxLength={JOURNAL_NOTEBOOK_NAME_MAX}
                autoFocus={draft.id === 'new'}
                dense
              />
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
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
          </>
        ) : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionTitle: { paddingHorizontal: 8 },
  surface: { overflow: 'hidden' },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 4,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  well: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, minWidth: 0 },
  editor: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
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
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
