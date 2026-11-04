import React from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { layout, space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatShortDate } from '../../utils/dates';
import { todoSection, type Todo } from '../../protocol';

type Props = {
  todo: Todo;
  today: string;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  onLongPressReorder?: (event: GestureResponderEvent) => void;
  onReorderTouchMove?: (event: GestureResponderEvent) => void;
  onReorderTouchEnd?: (event: GestureResponderEvent) => void;
  onReorderTouchCancel?: (event: GestureResponderEvent) => void;
  delayLongPressReorder?: number;
  reorderHint?: string;
};

/** Days `dueDate` is behind `today`, both plain calendar dates. */
function daysLate(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((now - due) / 86_400_000);
}

export default function TodoRow({
  todo,
  today,
  onToggle,
  onOpen,
  onLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  delayLongPressReorder,
  reorderHint,
}: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { t } = useTranslation('todos');

  const section = todoSection(todo, today);
  const overdue = section === 'overdue';

  let deadline: string | null = null;
  if (todo.dueDate != null) {
    if (section === 'today') {
      deadline = t('row.dueToday');
    } else if (overdue) {
      deadline = t('row.overdueBy', { count: daysLate(todo.dueDate, today) });
    } else {
      deadline = formatShortDate(todo.dueDate);
    }
  }

  return (
    <Pressable
      onPress={() => onOpen(todo)}
      onLongPress={onLongPressReorder}
      onTouchMove={onReorderTouchMove}
      onTouchEnd={onReorderTouchEnd}
      onTouchCancel={onReorderTouchCancel}
      delayLongPress={delayLongPressReorder}
      accessibilityRole="button"
      accessibilityLabel={t('row.openA11y', { title: todo.title })}
      accessibilityHint={reorderHint}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: deco.radius.lg,
          transform: [{ scale: pressed ? PRESSED_SCALE : 1 }],
        },
      ]}
    >
      {/* Its own hit target: ticking must never be a mis-tap away from editing. */}
      <Pressable
        onPress={() => onToggle(todo)}
        hitSlop={0}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={t('row.doneA11y', { title: todo.title })}
        style={styles.tickTarget}
      >
        <View style={[styles.tickRing, { borderColor: theme.colors.onSurfaceVariant }]} />
      </Pressable>

      <View style={styles.body}>
        <Text style={[typeScale.body, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {todo.title}
        </Text>

        {deadline || todo.note ? (
          <View style={styles.meta}>
            {deadline ? (
              <Text
                style={[
                  typeScale.secondary,
                  { color: overdue ? theme.colors.error : theme.colors.onSurfaceVariant },
                ]}
              >
                {deadline}
              </Text>
            ) : null}
            {todo.note ? (
              <MaterialCommunityIcons
                name="note-text-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
                accessibilityLabel={t('row.hasNote')}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The same give as a habit tile under a finger. */
const PRESSED_SCALE = 0.98;
const TICK_TARGET = 48;
const TICK_RING = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingLeft: space.xs,
    paddingRight: space.lg,
    paddingVertical: space.sm,
    marginBottom: layout.rowGap,
    gap: space.xs,
  },
  tickTarget: {
    width: TICK_TARGET,
    height: TICK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickRing: {
    width: TICK_RING,
    height: TICK_RING,
    // Half the size: the ring is a circle.
    borderRadius: TICK_RING / 2,
    borderWidth: 1.5,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + space.xxs,
  },
});
