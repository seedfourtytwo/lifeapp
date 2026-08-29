import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Divider, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import QuietText from './QuietText';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = {
  title: string;
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

export default function TrackersCollapsibleSection({
  title,
  icon,
  accentColor,
  count,
  addLabel,
  showAddButton = true,
  defaultCollapsed = false,
  onAdd,
  children,
  emptyMessage,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const { decorations: deco, isCartoon } = useAppTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isEmpty = count === 0;
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Surface
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          borderRadius: deco.radius.md,
          borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
        },
      ]}
      elevation={0}
    >
      <Pressable
        onPress={() => setCollapsed((value) => !value)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={t('card.itemsCountA11y', { title, count })}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${accentColor}22`,
              borderRadius: isCartoon ? deco.radius.sm : 12,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={22} color={accentColor} />
        </View>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {count}
          </Text>
        </View>
        {showAddButton && onAdd ? (
          <View onStartShouldSetResponder={() => true}>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              hitSlop={8}
              style={styles.addHit}
            >
              <MaterialCommunityIcons name="plus" size={22} color={accentColor} />
            </Pressable>
          </View>
        ) : null}
        <MaterialCommunityIcons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {!collapsed ? (
        <>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          {isEmpty ? (
            <QuietText variant="bodySmall" style={styles.empty}>
              {emptyMessage}
            </QuietText>
          ) : (
            items.map((child, index) => (
              <React.Fragment key={index}>
                {index > 0 ? (
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                ) : null}
                {child}
              </React.Fragment>
            ))
          )}
        </>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  section: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    minHeight: 52,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  countBadge: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  addHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});
