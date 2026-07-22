import React from 'react';
import { Pressable, View } from 'react-native';
import { Card, Checkbox, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatHabitDescription, type HabitConfig } from '../../protocol';
import type { WidgetProps } from '../types';
import { HabitStreakBadge } from './HabitStreakBadge';
import { NoteIconButton } from '../../notes/NoteIconButton';
import { habitWidgetStyles as styles } from './habitWidgetStyles';

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
  failureStreak,
}: WidgetProps<HabitConfig>) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const description = formatHabitDescription(config);

  return (
    <Card
      style={[
        styles.card,
        {
          borderRadius: deco.radius.md,
          borderWidth: isCartoon ? deco.cardBorderWidth : deco.borderWidth,
          borderColor: isCartoon ? theme.colors.outline : theme.colors.outlineVariant,
          backgroundColor: isCartoon ? theme.colors.surface : theme.colors.surfaceVariant,
          opacity: isDone ? 0.65 : 1,
        },
      ]}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.row}>
          <Checkbox
            status={isDone ? 'checked' : 'unchecked'}
            onPress={() => void onToggle?.()}
          />
          <Pressable
            onPress={onOpenDetails}
            disabled={!onOpenDetails}
            style={({ pressed }) => [
              styles.body,
              pressed && onOpenDetails && styles.pressed,
            ]}
          >
            <View style={styles.titleRow}>
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[
                  styles.name,
                  { flex: 1, minWidth: 0 },
                  isCartoon && { color: theme.colors.onSurface },
                ]}
              >
                {element.name}
              </Text>
              <HabitStreakBadge config={config} streak={streak} failureStreak={failureStreak} />
            </View>
            {description ? (
              <Text variant="bodySmall" style={styles.description} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
          </Pressable>
          {onDictateNote ? (
            <NoteIconButton
              hasNote={Boolean(hasTodayNote)}
              onPress={onDictateNote}
              onLongPress={onEditNote}
              size={16}
            />
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
}
