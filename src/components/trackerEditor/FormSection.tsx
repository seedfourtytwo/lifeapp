import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
};

export default function FormSection({
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const header = (
    <Pressable
      onPress={collapsible ? () => setCollapsed((value) => !value) : undefined}
      disabled={!collapsible}
      style={formSectionStyles.header}
      accessibilityRole={collapsible ? 'button' : undefined}
      accessibilityState={collapsible ? { expanded: !collapsed } : undefined}
    >
      <View style={formSectionStyles.headerText}>
        <Text variant="titleSmall" style={formSectionStyles.sectionTitle}>
          {title}
        </Text>
        {description && (!collapsible || !collapsed) ? (
          <Text variant="bodySmall" style={formSectionStyles.sectionDescription}>
            {description}
          </Text>
        ) : null}
      </View>
      {collapsible ? (
        <MaterialCommunityIcons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={22}
          style={formSectionStyles.chevron}
        />
      ) : null}
    </Pressable>
  );

  return (
    <View style={formSectionStyles.section}>
      {header}
      {!collapsed ? children : null}
    </View>
  );
}

export const formSectionStyles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionDescription: {
    opacity: 0.65,
    marginBottom: 12,
    lineHeight: 18,
  },
  chevron: {
    opacity: 0.55,
    marginTop: 2,
  },
  sectionBody: {
    marginTop: 12,
  },
  field: {
    marginBottom: 12,
  },
  inlineLabel: {
    marginBottom: 8,
  },
  hint: {
    opacity: 0.6,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  weekdayChip: {
    minWidth: 36,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  switchLabel: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  divider: {
    marginTop: 16,
  },
});
