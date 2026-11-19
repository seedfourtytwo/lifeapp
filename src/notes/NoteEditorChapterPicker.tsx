import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { EditorSheet, SheetCheck } from '../components/sheet';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
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
  /** The scrim, a pull down and Android back: nothing leaves the journal. */
  onCancel: () => void;
};

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
  const { decorations: deco } = useAppTheme();

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
      stale: theme.dark ? NOTE_SHARE_STALE_DARK : NOTE_SHARE_STALE_LIGHT,
      idle: theme.colors.onSurfaceVariant,
    });

  // The sheet keeps its last title while it slides shut.
  const lastMode = React.useRef<SharePickerMode>('share');
  if (mode) lastMode.current = mode;
  const copying = lastMode.current === 'copy';

  return (
    <EditorSheet
      visible={mode != null}
      onDismiss={onCancel}
      title={copying ? t('share.copyTitle') : t('share.shareTitle')}
      primaryAction={{
        label: copying ? t('share.confirmCopy') : t('share.confirmShare'),
        onPress: onConfirm,
        disabled: chosenCount === 0,
      }}
    >
      <View style={styles.toolbar}>
        <QuietText style={[typeScale.caption, styles.count]}>
          {chosenCount === 0
            ? t('share.nothingSelected')
            : t('share.selectedCount', { count: chosenCount, total: withText.length })}
        </QuietText>
        <Button compact mode="text" onPress={onSelectAll}>
          {t('share.selectAll')}
        </Button>
        <Button compact mode="text" onPress={onSelectNone}>
          {t('share.selectNone')}
        </Button>
      </View>

      <View>
        {chapters.map((chapter) => {
          const status = statuses[chapter.id] ?? 'never';
          const preview = journalChapterPreview(chapter.body);
          const checked = picked.has(chapter.id);
          return (
            <Pressable
              key={chapter.id}
              onPress={() => onToggle(chapter.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${t('share.toggleA11y', { number: chapter.number })}. ${statusLabel(status)}`}
              android_ripple={{ color: theme.colors.outlineVariant }}
              style={[styles.row, { borderRadius: deco.radius.sm }]}
            >
              <SheetCheck checked={checked} />
              <View style={styles.rowText}>
                <Text
                  style={[typeScale.body, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {preview
                    ? t('chapters.jumpLabel', { number: chapter.number, preview })
                    : t('chapters.label', { number: chapter.number })}
                </Text>
                <Text style={[typeScale.caption, { color: statusColor(status) }]}>
                  {statusLabel(status)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
});
