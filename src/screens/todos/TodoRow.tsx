import React, { memo } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatShortDate } from '../../utils/dates';
import { todoSection, type Todo } from '../../protocol';
import TodayMark from '../today/TodayMark';

type Props = {
  todo: Todo;
  today: string;
  /** The box was pressed: the todo is finished. */
  onToggle: (todo: Todo) => void;
  /** The words were pressed: open the editor. */
  onOpen: (todo: Todo) => void;
  /** Picked up for a drag: the row keeps its wash while it is carried. */
  lifted?: boolean;
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

/** The box's touch target; the drawn square sits in the middle of it. */
export const TODO_MARK_TARGET = 48;
/** Where a todo's words start, from the row's left edge. The quick-add lines up with it. */
export const TODO_TITLE_INSET = TODO_MARK_TARGET + space.sm;

/**
 * An open todo, written straight on the page: a box to tick and a line of
 * words. A tile is kept for the live daily controls — a habit, a counter — so
 * a one-off errand does not borrow their weight.
 *
 * The box is its own target, so finishing is never a mis-tap away from
 * editing. Pressing the words washes the row in the well colour; nothing is
 * dimmed.
 */
function TodoRow({
  todo,
  today,
  onToggle,
  onOpen,
  lifted = false,
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

  // Every dated todo says when it is due: the list carries no due headings.
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
        { borderRadius: deco.radius.lg },
        (pressed || lifted) && { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <Pressable
        onPress={() => onToggle(todo)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={t('row.doneA11y', { title: todo.title })}
        style={styles.mark}
      >
        <TodayMark kind="todoOpen" />
      </Pressable>

      <View style={styles.body}>
        <Text style={[typeScale.body, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {todo.title}
        </Text>

        {deadline || todo.note ? (
          <View style={styles.meta}>
            {deadline ? (
              <QuietText
                numberOfLines={1}
                style={[typeScale.secondary, overdue && { color: theme.colors.error }]}
              >
                {deadline}
              </QuietText>
            ) : null}
            {todo.note ? (
              <MaterialCommunityIcons
                name="note-text-outline"
                size={NOTE_GLYPH}
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

const NOTE_GLYPH = 14;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: space.sm,
    paddingRight: space.md,
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  // No text in it, so the target is a fixed box.
  mark: {
    width: TODO_MARK_TARGET,
    height: TODO_MARK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
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

/** Memoised: with stable callbacks, a tick re-renders the rows that moved. */
export default memo(TodoRow);
