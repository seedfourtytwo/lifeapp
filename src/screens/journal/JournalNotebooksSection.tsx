import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { EditorSheet, FilledField } from '../../components/sheet';
import IconPickerField from '../../components/trackerEditor/IconPickerField';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
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
import NotebookMark from './NotebookMark';
import { confirm, notify } from '../../components/sheet/confirm';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  notebooks: JournalNotebook[];
  onChanged: () => void;
};

type Draft = {
  id: string | 'new';
  name: string;
  color: JournalNotebookColor;
  icon?: TrackerIconId;
};

/** A swatch in the colour picker, and the ring that marks the picked one. */
const SWATCH = 32;
const SWATCH_TARGET = 44;
const SWATCH_RING = 2;

function NotebookWell({ notebook }: { notebook: Pick<JournalNotebook, 'color' | 'icon'> }) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <View
      style={[
        styles.well,
        { backgroundColor: theme.colors.surfaceVariant, borderRadius: deco.radius.pill },
      ]}
    >
      <NotebookMark notebook={notebook} ringColor={theme.colors.surfaceVariant} />
    </View>
  );
}

/**
 * Everything about managing notebooks — add, rename, colour and glyph,
 * reorder, delete — in one sheet opened from the Journal header. None of it
 * sits on the page: the page is for writing and reading.
 *
 * Editing one notebook opens a second sheet over this one. It mounts later, so
 * it draws on top and is the first to answer the back button.
 */
export default function JournalNotebooksSection({
  visible,
  onDismiss,
  notebooks,
  onChanged,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco } = useAppTheme();
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
      void notify({
        title: t('notebooks.nameRequiredTitle'),
        message: t('notebooks.nameRequiredBody'),
      });
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
      void notify({
        title: t('notebooks.couldNotSaveTitle'),
        message: error instanceof Error ? error.message : t('screen.couldNotLoadJournalsFallback'),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (notebook: JournalNotebook) => {
    if (notebooks.length <= 1) {
      void notify({
        title: t('notebooks.cannotDeleteLastTitle'),
        message: t('notebooks.cannotDeleteLastBody'),
      });
      return;
    }
    void (async () => {
      const confirmed = await confirm({
        title: t('notebooks.deleteTitle', { name: notebook.name }),
        message: t('notebooks.deleteBody'),
        confirmLabel: t('notebooks.deleteAction'),
        cancelLabel: t('editorSheet.cancel'),
        destructive: true,
      });
      if (!confirmed) return;
      setBusy(true);
      try {
        await deleteJournalNotebook(notebook.id);
        if (draft?.id === notebook.id) setDraft(null);
        onChanged();
      } catch (error) {
        void notify({
          title: t('notebooks.couldNotDeleteTitle'),
          message:
            error instanceof Error ? error.message : t('screen.couldNotLoadJournalsFallback'),
        });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <EditorSheet visible={visible} onDismiss={onDismiss} title={t('notebooks.title')}>
        <View>
          {notebooks.map((notebook, index) => (
            <React.Fragment key={notebook.id}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => startEdit(notebook)}
                  style={styles.rowMain}
                  accessibilityRole="button"
                  accessibilityLabel={t('notebooks.editA11y', { name: notebook.name })}
                >
                  <NotebookWell notebook={notebook} />
                  <Text
                    style={[typeScale.rowName, styles.rowName, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                  >
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

          {canAdd ? (
            <Pressable
              onPress={startNew}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('notebooks.add')}
              style={styles.rowMain}
            >
              <View style={styles.well}>
                <MaterialCommunityIcons name="plus" size={22} color={theme.colors.primary} />
              </View>
              <Text style={[typeScale.rowName, styles.rowName, { color: theme.colors.primary }]}>
                {t('notebooks.add')}
              </Text>
            </Pressable>
          ) : (
            <Text style={[typeScale.secondary, styles.maxReached, { color: theme.colors.onSurfaceVariant }]}>
              {t('notebooks.maxReached', { count: JOURNAL_NOTEBOOK_MAX })}
            </Text>
          )}
        </View>
      </EditorSheet>

      <EditorSheet
        visible={draft != null}
        onDismiss={() => setDraft(null)}
        dismissable={!busy}
        title={draft?.id === 'new' ? t('notebooks.newTitle') : t('notebooks.editTitle')}
        primaryAction={{
          label: t('editorSheet.save'),
          onPress: () => void save(),
          loading: busy,
          disabled: busy,
        }}
      >
        {draft ? (
          <>
            <FilledField
              placeholder={t('notebooks.nameLabel')}
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              maxLength={JOURNAL_NOTEBOOK_NAME_MAX}
              autoFocus={draft.id === 'new'}
            />
            <View style={styles.colorBlock}>
              <Text style={[typeScale.caption, { color: theme.colors.onSurfaceVariant }]}>
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
                        styles.swatchTarget,
                        {
                          borderRadius: deco.radius.pill,
                          borderColor: selected ? theme.colors.onSurface : 'transparent',
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('notebooks.colorA11y', { color })}
                    >
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: color, borderRadius: deco.radius.pill },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <IconPickerField
              value={draft.icon ?? null}
              onChange={(icon) => setDraft({ ...draft, icon: icon ?? undefined })}
            />
          </>
        ) : null}
      </EditorSheet>
    </>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    // The overflow glyph's box supplies its own room at the sheet's edge.
    marginRight: -space.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  maxReached: {
    paddingVertical: space.md,
  },
  well: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, minWidth: 0 },
  colorBlock: {
    gap: space.sm,
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  swatchTarget: {
    width: SWATCH_TARGET,
    height: SWATCH_TARGET,
    borderWidth: SWATCH_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
  },
});
