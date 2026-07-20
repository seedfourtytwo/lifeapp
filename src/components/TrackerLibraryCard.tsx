import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

export type TrackerLibraryBadge = {
  label: string;
  tone?: 'accent' | 'muted';
};

type Props = {
  kind: 'counter' | 'habit';
  accentColor: string;
  name: string;
  badges: TrackerLibraryBadge[];
  metaLines: string[];
  archived?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
};

function kindIcon(kind: 'counter' | 'habit'): keyof typeof MaterialCommunityIcons.glyphMap {
  return kind === 'counter' ? 'counter' : 'checkbox-marked-circle-outline';
}

export default function TrackerLibraryCard({
  kind,
  accentColor,
  name,
  badges,
  metaLines,
  archived = false,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
}: Props) {
  const theme = useTheme();
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
    >
      <View style={styles.content}>
        <View style={[styles.kindIcon, { backgroundColor: `${accentColor}18` }]}>
          <MaterialCommunityIcons name={kindIcon(kind)} size={20} color={accentColor} />
        </View>
        <View style={styles.main}>
          <Text variant="titleMedium" style={styles.name}>
            {name}
          </Text>
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
          Edit
        </Button>
        {archived ? (
          <Button mode="outlined" compact icon="archive-arrow-up-outline" onPress={onRestore} style={styles.actionButton}>
            Restore
          </Button>
        ) : (
          <Button mode="outlined" compact icon="archive-arrow-down-outline" onPress={onArchive} style={styles.actionButton}>
            Archive
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
          Delete
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
  },
  kindIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
