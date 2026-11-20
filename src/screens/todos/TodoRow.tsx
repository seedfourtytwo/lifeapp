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
import { rowKindColour } from '../../kinds/rowKind';
import { trackerCardStyles as cardStyles } from '../../kinds/trackerCardStyles';
import { ROW_TILE_SIZE, TrackerIdentityMark } from '../../kinds/TrackerIdentityMark';
import { todoSection, type Todo } from '../../protocol';

type Props = {
  todo: Todo;
  today: string;
  /** The box was pressed: the todo is finished. */
  onToggle: (todo: Todo) => void;
  /** The words were pressed: open the editor. */
  onOpen: (todo: Todo) => void;
  /** Picked up for a drag: the tile keeps its pressed ground while it is carried. */
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
/** The words stand this far off the tile, beyond the row's own gap. */
export const TODO_TITLE_OFFSET = space.xs;
/**
 * Where a todo's words start, from the row's left edge: the row's padding, the
 * tile, the row gap and the offset. The quick-add line keeps the same column.
 */
export const TODO_TITLE_INSET = space.md + ROW_TILE_SIZE + space.sm + TODO_TITLE_OFFSET;
/** The drawn box. */
const BOX = 34;

/**
 * An open todo, on a tile like the habits and counters above it: the todos'
 * lilac tile, the words, and a box to tick at the end.
 *
 * The box is its own target, so finishing is never a mis-tap away from
 * editing. Pressing the words puts the tile on the well colour; nothing is
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
  const { decorations: deco, palette } = useAppTheme();
  const kind = rowKindColour({ kind: 'todo' });
  const ink = palette.kind[kind].ink;
  const { t } = useTranslation('todos');

  const section = todoSection(todo, today);
  // Due now or already late: the caption takes the todos' colour.
  const pressing = section === 'today' || section === 'overdue';

  // Every dated todo says when it is due: the list carries no due headings.
  let deadline: string | null = null;
  if (todo.dueDate != null) {
    if (section === 'today') {
      deadline = t('row.dueToday');
    } else if (section === 'overdue') {
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
        cardStyles.card,
        cardStyles.oneLineRow,
        {
          borderRadius: deco.radius.lg,
          backgroundColor:
            pressed || lifted ? theme.colors.surfaceVariant : theme.colors.surface,
        },
      ]}
    >
      <TrackerIdentityMark kind={kind} />

      <View style={styles.body}>
        <Text style={[typeScale.body, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {todo.title}
        </Text>

        {deadline || todo.note ? (
          <View style={styles.meta}>
            {deadline ? (
              <QuietText
                numberOfLines={1}
                style={[typeScale.secondary, pressing && { color: ink }]}
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

      <Pressable
        onPress={() => onToggle(todo)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={t('row.doneA11y', { title: todo.title })}
        style={styles.mark}
      >
        <View style={[styles.box, { borderColor: ink, borderRadius: deco.radius.sm }]} />
      </Pressable>
    </Pressable>
  );
}

const NOTE_GLYPH = 14;

const styles = StyleSheet.create({
  // No text in it, so the target is a fixed box.
  mark: {
    width: TODO_MARK_TARGET,
    height: TODO_MARK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The empty box: a todo still to do. */
  box: {
    width: BOX,
    height: BOX,
    borderWidth: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    // With the row's own gap this is the same step a tracker's words sit from its tile.
    marginLeft: TODO_TITLE_OFFSET,
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
