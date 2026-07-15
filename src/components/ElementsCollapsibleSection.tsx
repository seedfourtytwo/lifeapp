import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Divider, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
  count: number;
  addLabel?: string;
  showAddButton?: boolean;
  defaultCollapsed?: boolean;
  onAdd?: () => void;
  children: React.ReactNode;
  emptyMessage: string;
};

export default function ElementsCollapsibleSection({
  title,
  subtitle,
  icon,
  accentColor,
  count,
  addLabel = 'Add',
  showAddButton = true,
  defaultCollapsed = false,
  onAdd,
  children,
  emptyMessage,
}: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isEmpty = count === 0;

  return (
    <Surface
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          borderRadius: deco.radius.md,
        },
        isCartoon && { borderWidth: deco.cardBorderWidth },
      ]}
      elevation={0}
    >
      <Pressable
        onPress={() => setCollapsed((value) => !value)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${title}, ${count} items`}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}22` }]}>
          <MaterialCommunityIcons name={icon} size={22} color={accentColor} />
        </View>
        <View style={styles.headerText}>
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {subtitle}
          </Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {count}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={24}
          color={theme.colors.onSurfaceVariant}
          style={styles.chevron}
        />
      </Pressable>

      {!collapsed ? (
        <>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <View style={styles.body}>
            {isEmpty ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {emptyMessage}
              </Text>
            ) : (
              children
            )}
            {showAddButton && onAdd ? (
              <Button
                mode="outlined"
                icon="plus"
                onPress={onAdd}
                style={styles.addButton}
                contentStyle={styles.addButtonContent}
              >
                {addLabel}
              </Button>
            ) : null}
          </View>
        </>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginBottom: 2,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  addButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addButtonContent: {
    paddingHorizontal: 4,
  },
});
