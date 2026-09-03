import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Modal, Portal, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { journalChapterPreview } from './journalChapters';
import type { ShareChapterView } from './journalShareSelection';
import {
  NOTE_SHARE_STALE_DARK,
  NOTE_SHARE_STALE_LIGHT,
  noteShareActionColor,
  type NoteShareStatus,
} from './noteShareStatus';
import type { SharePickerMode } from './useNoteEditorExport';

type Props = {
  /** Null keeps the picker closed; the mode decides the title and the verb. */
  mode: SharePickerMode | null;
  chapters: readonly ShareChapterView[];
  selected: readonly string[];
  /** Per-chapter never/stale/current, so the roll-up on the header stays readable. */
  statuses: Readonly<Record<string, NoteShareStatus>>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const PICKER_MAX_WIDTH = 400;
const PICKER_GUTTER = 24;

/**
 * Which chapters leave the journal.
 *
 * A notebook day is several pieces of writing, and until now every one of them
 * went out together because they shared a date. This is the one step between
 * the reader and the share sheet: everything ticked by default, so the plain
 * tap-tap still sends the whole day, and one tap per chapter to send less.
 *
 * Each row also carries the colour the header icon used to carry alone — grey
 * for never sent, amber for changed since, primary for up to date — which is
 * what makes a per-chapter fingerprint worth having.
 */
export default function NoteEditorChapterPicker({
  mode,
  chapters,
  selected,
  statuses,
  onToggle,
  onSelectAll,
  onSelectNone,
  onConfirm,
  onCancel,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco, isCartoon } = useAppTheme();

  const picked = new Set(selected);
  const withText = chapters.filter((chapter) => chapter.body.trim().length > 0);
  const chosenCount = withText.filter((chapter) => picked.has(chapter.id)).length;

  const statusLabel = (status: NoteShareStatus) =>
    status === 'current'
      ? t('share.statusCurrent')
      : status === 'stale'
        ? t('share.statusStale')
        : t('share.statusNever');

  const statusColor = (status: NoteShareStatus) =>
    noteShareActionColor(status, {
      current: theme.colors.primary,
      stale: isCartoon
        ? theme.colors.secondary
        : theme.dark
          ? NOTE_SHARE_STALE_DARK
          : NOTE_SHARE_STALE_LIGHT,
      idle: theme.colors.onSurfaceVariant,
    });

  return (
    <Portal>
      <Modal
        visible={mode != null}
        onDismiss={onCancel}
        style={styles.wrap}
        contentContainerStyle={[
          styles.modal,
          {
            maxWidth: PICKER_MAX_WIDTH,
            marginHorizontal: PICKER_GUTTER,
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
            ...(isCartoon && {
              borderWidth: deco.cardBorderWidth,
              borderColor: theme.colors.outline,
            }),
          },
        ]}
      >
        <Text variant="titleMedium">
          {mode === 'copy' ? t('share.copyTitle') : t('share.shareTitle')}
        </Text>
        <View style={styles.toolbar}>
          <QuietText variant="labelSmall" style={styles.count}>
            {t('share.selectedCount', { count: chosenCount, total: withText.length })}
          </QuietText>
          <Button compact mode="text" onPress={onSelectAll}>
            {t('share.selectAll')}
          </Button>
          <Button compact mode="text" onPress={onSelectNone}>
            {t('share.selectNone')}
          </Button>
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {chapters.map((chapter) => {
            const status = statuses[chapter.id] ?? 'never';
            const preview = journalChapterPreview(chapter.body);
            const checked = picked.has(chapter.id);
            return (
              <TouchableRipple
                key={chapter.id}
                onPress={() => onToggle(chapter.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${t('share.toggleA11y', { number: chapter.number })}. ${statusLabel(status)}`}
                style={[styles.row, { borderRadius: deco.radius.sm }]}
              >
                <View style={styles.rowInner}>
                  <Checkbox status={checked ? 'checked' : 'unchecked'} />
                  <View style={styles.rowText}>
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {preview
                        ? t('chapters.jumpLabel', { number: chapter.number, preview })
                        : t('chapters.label', { number: chapter.number })}
                    </Text>
                    <Text variant="labelSmall" style={{ color: statusColor(status) }}>
                      {statusLabel(status)}
                    </Text>
                  </View>
                </View>
              </TouchableRipple>
            );
          })}
        </ScrollView>

        {chosenCount === 0 ? (
          <QuietText variant="labelSmall" style={styles.hint}>
            {t('share.nothingSelected')}
          </QuietText>
        ) : null}

        <View style={styles.actions}>
          <Button mode="text" onPress={onCancel}>
            {t('share.cancel')}
          </Button>
          <Button mode="contained" disabled={chosenCount === 0} onPress={onConfirm}>
            {mode === 'copy' ? t('share.confirmCopy') : t('share.confirmShare')}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  modal: {
    alignSelf: 'center',
    width: '100%',
    padding: space.lg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xs,
  },
  count: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    maxHeight: 280,
  },
  row: {
    minHeight: 48,
    justifyContent: 'center',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.sm,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    marginTop: space.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
});
