import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CollapseChevron, Collapsible } from './Collapsible';
import QuietText from './QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import Rule from './Rule';

type Props = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
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
  const { decorations: deco } = useAppTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isEmpty = count === 0;
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Surface
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: deco.radius.lg,
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
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: deco.radius.md,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={22} color={theme.colors.onSurfaceVariant} />
        </View>
        <Text style={[typeScale.rowName, styles.title, { color: theme.colors.onSurface }]}>
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
              <MaterialCommunityIcons name="plus" size={22} color={theme.colors.primary} />
            </Pressable>
          </View>
        ) : null}
        <CollapseChevron open={!collapsed} size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>

      <Collapsible open={!collapsed}>
        <Rule />
        {isEmpty ? (
          <QuietText style={[typeScale.secondary, styles.empty]}>{emptyMessage}</QuietText>
        ) : (
          items.map((child, index) => (
            <React.Fragment key={index}>
              {index > 0 ? <Rule /> : null}
              {child}
            </React.Fragment>
          ))
        )}
      </Collapsible>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
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
    // Geometric, not decorative: half the height is what makes it a circle,
    // so this is one of the few radii that must not follow the theme.
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  addHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: space.lg,
  },
});
