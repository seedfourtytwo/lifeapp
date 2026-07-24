import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from './trackerIcons/TrackerIcon';

export type TrackerLibraryBadge = {
  label: string;
  tone?: 'accent' | 'muted';
};

type Props = {
  accentColor: string;
  name: string;
  icon?: TrackerIconId | null;
  badges: TrackerLibraryBadge[];
  metaLines: string[];
  archived?: boolean;
  onEdit: () => void;
  onHistory?: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
};

/**
 * Trackers library row — same identity rule as Home:
 * custom icon → icon only; otherwise text name only (never both).
 */
export default function TrackerLibraryCard({
  accentColor,
  name,
  icon = null,
  badges,
  metaLines,
  archived = false,
  onEdit,
  onHistory,
  onDelete,
  onArchive,
  onRestore,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const { decorations: deco, isCartoon } = useAppTheme();

  const badgeColors = (tone: TrackerLibraryBadge['tone']) => {
    switch (tone) {
      case 'accent':
        return {
          backgroundColor: `${accentColor}22`,
          color: accentColor,
        };
      case 'muted':
        return {
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurfaceVariant,
        };
      default:
        return {
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurfaceVariant,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          borderRadius: deco.radius.sm,
          opacity: archived ? 0.88 : 1,
        },
        isCartoon && { borderWidth: deco.borderWidth },
      ]}
      accessibilityLabel={name}
    >
      <View style={styles.content}>
        {icon ? (
          <View style={[styles.identityWell, { backgroundColor: `${accentColor}18` }]}>
            <TrackerIcon name={icon} size={22} color={accentColor} />
          </View>
        ) : null}
        <View style={styles.main}>
          {!icon ? (
            <Text variant="titleMedium" style={styles.name}>
              {name}
            </Text>
          ) : null}
          {badges.length > 0 ? (
            <View style={styles.badges}>
              {badges.map((badge) => {
                const colors = badgeColors(badge.tone);
                return (
                  <View
                    key={badge.label}
                    style={[styles.badge, { backgroundColor: colors.backgroundColor }]}
                  >
                    <Text variant="labelSmall" style={{ color: colors.color }}>
                      {badge.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {metaLines.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              variant="bodySmall"
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              {line}
            </Text>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.actionsBar,
          { backgroundColor: theme.colors.surfaceVariant, borderTopColor: theme.colors.outlineVariant },
        ]}
      >
        <Button mode="contained-tonal" compact onPress={onEdit} style={styles.actionButton}>
          {t('card.edit')}
        </Button>
        {onHistory ? (
          <Button
            mode="outlined"
            compact
            icon="chart-box-outline"
            onPress={onHistory}
            style={styles.actionButton}
          >
            {t('card.history')}
          </Button>
        ) : null}
        {archived ? (
          <Button mode="outlined" compact icon="archive-arrow-up-outline" onPress={onRestore} style={styles.actionButton}>
            {t('card.restore')}
          </Button>
        ) : (
          <Button mode="outlined" compact icon="archive-arrow-down-outline" onPress={onArchive} style={styles.actionButton}>
            {t('card.archive')}
          </Button>
        )}
        <Button
          mode="outlined"
          compact
          icon="delete-outline"
          onPress={onDelete}
          style={[
            styles.actionButton,
            styles.deleteButton,
            {
              borderColor: theme.colors.error,
              backgroundColor: theme.colors.errorContainer,
            },
          ]}
          textColor={theme.colors.onErrorContainer}
        >
          {t('card.delete')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  identityWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meta: {
    marginTop: 4,
    lineHeight: 18,
  },
  actionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    minWidth: 0,
  },
  deleteButton: {
    marginLeft: 'auto',
  },
});
