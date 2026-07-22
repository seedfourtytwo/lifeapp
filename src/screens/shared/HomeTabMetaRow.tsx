import React from 'react';
import { View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { homeTabScreenStyles as styles } from './screenStyles';

type Props = {
  hasTodayJournal: boolean;
  onOpenJournal: () => void;
  /** Optional trailing control (Sort / Done). */
  trailing?: React.ReactNode;
  /** Leading status text / empty spacer. */
  leading?: React.ReactNode;
};

/** Shared Habits/Counters top row: status · journal · sort. */
export default function HomeTabMetaRow({
  hasTodayJournal,
  onOpenJournal,
  trailing,
  leading,
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaStatus}>{leading}</View>
      <View style={styles.metaRight}>
        <IconButton
          icon={hasTodayJournal ? 'notebook' : 'notebook-outline'}
          size={20}
          onPress={onOpenJournal}
          iconColor={
            hasTodayJournal ? theme.colors.primary : theme.colors.onSurfaceVariant
          }
          accessibilityLabel={
            hasTodayJournal ? "Edit today's journal" : "Write today's journal"
          }
          style={styles.metaIconButton}
        />
        {trailing}
      </View>
    </View>
  );
}
