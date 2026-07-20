import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { List, Menu, Text, useTheme } from 'react-native-paper';
import { REMINDER_PRESET_OPTIONS } from '../../calendar/defaults';
import { formatReminderOffset } from '../../calendar/format';

interface Props {
  reminderOffsets: number[];
  addReminderOpen: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  onAdd: (offsetMinutes: number) => void;
  onRemove: (offsetMinutes: number) => void;
}

/** Reminder offset list + preset picker for the event editor. */
export default function EventRemindersSection({
  reminderOffsets,
  addReminderOpen,
  onOpenAdd,
  onCloseAdd,
  onAdd,
  onRemove,
}: Props) {
  const theme = useTheme();
  const availableReminders = REMINDER_PRESET_OPTIONS.filter(
    (preset) => !reminderOffsets.includes(preset.offsetMinutes),
  );

  return (
    <>
      <List.Subheader style={styles.subheader}>Notifications</List.Subheader>
      {reminderOffsets.length === 0 ? (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            paddingHorizontal: 16,
            marginBottom: 4,
          }}
        >
          None — you’ll only see this on the calendar
        </Text>
      ) : (
        reminderOffsets.map((offset) => (
          <List.Item
            key={offset}
            title={formatReminderOffset(offset)}
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={() => (
              <Pressable onPress={() => onRemove(offset)} hitSlop={8}>
                <List.Icon icon="close" color={theme.colors.onSurfaceVariant} />
              </Pressable>
            )}
          />
        ))
      )}
      <Menu
        visible={addReminderOpen}
        onDismiss={onCloseAdd}
        anchor={
          <List.Item
            title="Add notification"
            disabled={availableReminders.length === 0}
            titleStyle={{ color: theme.colors.primary }}
            left={(props) => (
              <List.Icon {...props} icon="bell-plus-outline" color={theme.colors.primary} />
            )}
            onPress={() => availableReminders.length > 0 && onOpenAdd()}
          />
        }
      >
        {availableReminders.map((preset) => (
          <Menu.Item
            key={preset.offsetMinutes}
            onPress={() => onAdd(preset.offsetMinutes)}
            title={preset.label}
          />
        ))}
      </Menu>
    </>
  );
}

const styles = StyleSheet.create({
  subheader: {
    paddingTop: 4,
    paddingBottom: 0,
  },
});
