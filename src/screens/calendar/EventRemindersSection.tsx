import React from 'react';
import { IconButton, Menu, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { REMINDER_PRESET_OPTIONS } from '../../calendar/defaults';
import { formatReminderOffset } from '../../calendar/format';
import { SettingsGroup, SettingsRow } from '../../components/settings';

interface Props {
  reminderOffsets: number[];
  addReminderOpen: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  onAdd: (offsetMinutes: number) => void;
  onRemove: (offsetMinutes: number) => void;
}

/** Reminder offset list + preset picker for the event editor, as one group of rows. */
export default function EventRemindersSection({
  reminderOffsets,
  addReminderOpen,
  onOpenAdd,
  onCloseAdd,
  onAdd,
  onRemove,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('calendar');
  const availableReminders = REMINDER_PRESET_OPTIONS.filter(
    (preset) => !reminderOffsets.includes(preset.offsetMinutes),
  );

  return (
    <SettingsGroup
      title={t('editor.notificationsSectionTitle')}
      caption={reminderOffsets.length === 0 ? t('editor.noneReminderHint') : undefined}
    >
      {reminderOffsets.map((offset) => {
        const label = formatReminderOffset(offset);
        return (
          <SettingsRow
            key={offset}
            icon="bell-outline"
            title={label}
            trailing={
              <IconButton
                icon="close"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => onRemove(offset)}
                accessibilityLabel={t('editor.removeNotificationA11y', { label })}
                style={{ margin: 0 }}
              />
            }
          />
        );
      })}
      <Menu
        visible={addReminderOpen}
        onDismiss={onCloseAdd}
        anchor={
          <SettingsRow
            icon="bell-plus-outline"
            iconColor={theme.colors.primary}
            title={t('editor.addNotification')}
            disabled={availableReminders.length === 0}
            onPress={() => availableReminders.length > 0 && onOpenAdd()}
          />
        }
      >
        {availableReminders.map((preset) => (
          <Menu.Item
            key={preset.offsetMinutes}
            onPress={() => onAdd(preset.offsetMinutes)}
            title={t(preset.labelKey)}
          />
        ))}
      </Menu>
    </SettingsGroup>
  );
}
