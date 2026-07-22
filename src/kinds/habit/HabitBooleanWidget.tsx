import React from 'react';
import { View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatHabitDescription, type HabitConfig } from '../../protocol';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as styles } from '../trackerCardStyles';
import {
  formatHabitCardDescription,
  formatHabitStreakLabel,
} from './habitCardLabels';
import { HabitCardTitle } from './HabitCardTitle';
import { NoteIconButton } from '../../notes/NoteIconButton';

export function HabitBooleanWidget({
  element,
  config,
  isDone,
  onToggle,
  onOpenDetails,
  onDictateNote,
  onEditNote,
  hasTodayNote,
  streak,
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const done = Boolean(isDone);
  const streakLabel = formatHabitStreakLabel(config, streak);
  const description = formatHabitCardDescription(formatHabitDescription(config));

  return (
    <TrackerCard>
      <View style={styles.headerRow}>
        <HabitCardTitle
          name={element.name}
          streakLabel={streakLabel}
          description={description}
          onOpenDetails={onOpenDetails}
        />
        {onDictateNote ? (
          <View style={styles.metaCluster}>
            <NoteIconButton
              hasNote={Boolean(hasTodayNote)}
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={16}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Button
          mode="contained"
          icon={done ? 'check' : 'check-circle-outline'}
          onPress={() => void onToggle?.()}
          style={[styles.primaryButton, { borderRadius: deco.buttonRadius }]}
          buttonColor={isCartoon ? theme.colors.primary : undefined}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          accessibilityLabel={done ? 'Completed. Tap to undo' : 'Mark habit done'}
          accessibilityState={{ checked: done }}
        >
          {done ? 'Done' : 'Mark done'}
        </Button>
      </View>
    </TrackerCard>
  );
}
