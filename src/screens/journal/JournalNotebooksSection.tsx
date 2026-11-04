import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Menu, Surface, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Rule from '../../components/Rule';
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

export default function JournalNotebooksSection({ notebooks, onChanged }: Props) {
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
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('notebooks.title')}
      </Text>
      <Surface
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
          },
        ]}
        elevation={0}
      >
        <View style={styles.header}>
          {!canAdd ? (
            <Text style={[typeScale.secondary, { color: theme.colors.onSurfaceVariant, flex: 1 }]}>
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
            <Rule style={styles.rule} />
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

      </Surface>

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
    </View>
  );
}

/** Where a row's name starts: the gutter, the 40dp well and its gap. */
const NAME_INSET = space.lg + 40 + space.md;

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  sectionTitle: { ...typeScale.caption, fontSize: 14, paddingHorizontal: space.xs },
  surface: { overflow: 'hidden' },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  headerAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { marginLeft: NAME_INSET },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.xs,
    gap: space.xs,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
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
