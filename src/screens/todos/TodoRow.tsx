import React from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Checkbox, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
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
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: deco.radius.md,
          borderColor: overdue ? theme.colors.error : 'transparent',
          borderWidth: overdue ? deco.borderWidth : 0,
        },
      ]}
    >
      {/* Its own hit target: ticking must never be a mis-tap away from editing. */}
      <Checkbox.Android
        status="unchecked"
        onPress={() => onToggle(todo)}
        accessibilityLabel={t('row.doneA11y', { title: todo.title })}
      />

      <View style={styles.body}>
        <Text variant="bodyLarge" numberOfLines={2} style={{ color: theme.colors.onSurface }}>
          {todo.title}
        </Text>

        {deadline || todo.note ? (
          <View style={styles.meta}>
            {deadline ? (
              <Text
                variant="labelSmall"
                style={{
                  color: overdue ? theme.colors.error : theme.colors.onSurfaceVariant,
                  fontWeight: overdue ? '700' : '500',
                }}
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 4,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
