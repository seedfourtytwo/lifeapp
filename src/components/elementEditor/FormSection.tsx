import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function FormSection({ title, description, children }: Props) {
  return (
    <View style={formSectionStyles.section}>
      <Text variant="titleSmall" style={formSectionStyles.sectionTitle}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodySmall" style={formSectionStyles.sectionDescription}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export const formSectionStyles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionDescription: {
    opacity: 0.65,
    marginBottom: 12,
    lineHeight: 18,
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
