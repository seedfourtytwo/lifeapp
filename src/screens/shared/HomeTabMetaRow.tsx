import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NoteIconButton } from '../../notes/NoteIconButton';
import { homeTabScreenStyles as styles } from './screenStyles';

type Props = {
  hasTodayJournal: boolean;
  /** Tap: open today's journal and dictate. */
  onOpenJournal: () => void;
  /** Long-press: open today's journal for edit. */
  onEditJournal?: () => void;
  /** Leading status text / empty spacer. */
  leading?: React.ReactNode;
};

/** Shared Habits/Counters top row: status · journal note. */
export default function HomeTabMetaRow({
  hasTodayJournal,
  onOpenJournal,
  onEditJournal,
  leading,
}: Props) {
  const { t } = useTranslation('common');
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaStatus}>{leading}</View>
      <View style={styles.metaRight}>
        <NoteIconButton
          hasNote={hasTodayJournal}
          onPress={onOpenJournal}
          onLongPress={onEditJournal}
          accessibilityNoun={t('note.journalNoun')}
          size={22}
          style={styles.metaIconButton}
        />
      </View>
    </View>
  );
}
