import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Menu, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from './trackerIcons/TrackerIcon';
import SettingsRow from './settings/SettingsRow';
import { settingsRowStyles } from './settings/SettingsRow';

type Props = {
  name: string;
  icon?: TrackerIconId | null;
  description?: string;
  archived?: boolean;
  onEdit: () => void;
  onHistory?: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
};

export default function TrackerLibraryCard({
  name,
  icon = null,
  description,
  archived = false,
  onEdit,
  onHistory,
  onDelete,
  onArchive,
  onRestore,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [menuOpen, setMenuOpen] = useState(false);

  const well = (
    <View style={settingsRowStyles.iconSlot}>
      {icon ? (
        <TrackerIcon name={icon} size={24} color={theme.colors.onSurfaceVariant} />
      ) : (
        <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {name.trim().charAt(0).toUpperCase() || '·'}
        </Text>
      )}
    </View>
  );

  return (
    <SettingsRow
      left={well}
      title={name}
      description={description}
      onPress={onEdit}
      accessibilityLabel={name}
      trailing={
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('card.moreA11y', { name })}
              hitSlop={8}
              style={styles.more}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                size={22}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          }
        >
          {onHistory ? (
            <Menu.Item
              leadingIcon="chart-box-outline"
              title={t('card.history')}
              onPress={() => {
                setMenuOpen(false);
                onHistory();
              }}
            />
          ) : null}
          {archived ? (
            <Menu.Item
              leadingIcon="archive-arrow-up-outline"
              title={t('card.restore')}
              onPress={() => {
                setMenuOpen(false);
                onRestore?.();
              }}
            />
          ) : (
            <Menu.Item
              leadingIcon="archive-arrow-down-outline"
              title={t('card.archive')}
              onPress={() => {
                setMenuOpen(false);
                onArchive?.();
              }}
            />
          )}
          <Menu.Item
            leadingIcon="delete-outline"
            title={t('card.delete')}
            onPress={() => {
              setMenuOpen(false);
              onDelete();
            }}
          />
        </Menu>
      }
    />
  );
}

const styles = StyleSheet.create({
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
