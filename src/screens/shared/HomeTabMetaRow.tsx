import React from 'react';
import { View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { homeTabScreenStyles as styles } from './screenStyles';

type Props = {
  hasTodayJournal: boolean;
  /** Tap: open today's journal and dictate. */
  onOpenJournal: () => void;
  /** Long-press: open today's journal for edit. */
  onEditJournal?: () => void;
  /** Optional trailing control (Sort / Done). */
  trailing?: React.ReactNode;
  /** Leading status text / empty spacer. */
  leading?: React.ReactNode;
};

/** Shared Habits/Counters top row: status · journal mic · sort. */
export default function HomeTabMetaRow({
  hasTodayJournal,
  onOpenJournal,
  onEditJournal,
  trailing,
  leading,
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaStatus}>{leading}</View>
      <View style={styles.metaRight}>
        <IconButton
          icon="microphone-outline"
          size={20}
          onPress={onOpenJournal}
          onLongPress={onEditJournal}
          delayLongPress={350}
          iconColor={
            hasTodayJournal ? theme.colors.primary : theme.colors.onSurfaceVariant
          }
          accessibilityLabel={
            hasTodayJournal ? "Dictate today's journal" : "Dictate a new journal entry"
          }
          accessibilityHint={
            onEditJournal ? 'Long press to open and edit without dictating' : undefined
          }
          style={styles.metaIconButton}
        />
        {trailing}
      </View>
    </View>
  );
}
