import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Menu, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { journalChapterPreview, type JournalChapter } from './journalChapters';

type Props = {
  chapters: readonly JournalChapter[];
  /** Row id of the chapter on screen; null before the day's first save. */
  activeId: string | null;
  /** Position of the chapter on screen, 0-based — may be past the last saved one. */
  index: number;
  /** Chapters on file plus the unsaved one, if any. */
  total: number;
  /** True when the chapter on screen has never been saved. */
  isDraft: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: () => void;
};

/**
 * Moving around a notebook day.
 *
 * Chapters carry no titles, so the jump control names each one by its number
 * and its opening words — enough to find "the walk" among four entries without
 * asking anyone to title anything. Prev/next sit either side of it because
 * stepping is the common case and hunting is the rare one.
 */
export default function NoteEditorChapterBar({
  chapters,
  activeId,
  index,
  total,
  isDraft,
  locked,
  onSelect,
  onAdd,
  onDelete,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('journal');
  const { decorations: deco } = useAppTheme();
  const [jumpOpen, setJumpOpen] = useState(false);

  const canPrev = index > 0;
  const canNext = index < total - 1;
  const number = index + 1;
  const preview = isDraft
    ? ''
    : journalChapterPreview(chapters.find((c) => c.id === activeId)?.body ?? '');
  const label = preview
    ? t('chapters.jumpLabel', { number, preview })
    : t('chapters.label', { number });

  const step = (delta: number) => {
    const target = chapters[index + delta];
    if (target) onSelect(target.id);
  };

  return (
    <View style={styles.bar}>
      <IconButton
        icon="chevron-left"
        size={20}
        disabled={locked || !canPrev}
        onPress={() => step(-1)}
        accessibilityLabel={t('chapters.previousA11y')}
        style={styles.step}
      />
      <Menu
        visible={jumpOpen}
        onDismiss={() => setJumpOpen(false)}
        anchor={
          <TouchableRipple
            onPress={() => setJumpOpen(true)}
            disabled={locked || chapters.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('chapters.jumpA11y', { number, count: total })}
            style={[
              styles.jump,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: deco.radius.sm,
              },
            ]}
          >
            <View style={styles.jumpInner}>
              <Text variant="labelMedium" numberOfLines={1} style={styles.jumpLabel}>
                {label}
              </Text>
              <QuietText variant="labelSmall">{t('chapters.of', { count: total })}</QuietText>
            </View>
          </TouchableRipple>
        }
      >
        {chapters.map((chapter, position) => (
          <Menu.Item
            key={chapter.id}
            onPress={() => {
              setJumpOpen(false);
              onSelect(chapter.id);
            }}
            title={
              journalChapterPreview(chapter.body)
                ? t('chapters.jumpLabel', {
                    number: position + 1,
                    preview: journalChapterPreview(chapter.body),
                  })
                : t('chapters.label', { number: position + 1 })
            }
            leadingIcon={chapter.id === activeId ? 'check' : undefined}
          />
        ))}
      </Menu>
      <IconButton
        icon="chevron-right"
        size={20}
        disabled={locked || !canNext}
        onPress={() => step(1)}
        accessibilityLabel={t('chapters.nextA11y')}
        style={styles.step}
      />
      <IconButton
        icon="plus"
        size={20}
        disabled={locked || isDraft}
        onPress={onAdd}
        accessibilityLabel={t('chapters.addA11y')}
        style={styles.step}
      />
      <IconButton
        icon="trash-can-outline"
        size={20}
        disabled={locked || isDraft}
        onPress={onDelete}
        iconColor={theme.colors.error}
        accessibilityLabel={t('chapters.deleteA11y', { number })}
        style={styles.step}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    marginBottom: space.sm,
  },
  step: {
    margin: 0,
  },
  jump: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  jumpInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  jumpLabel: {
    flex: 1,
    minWidth: 0,
  },
});
