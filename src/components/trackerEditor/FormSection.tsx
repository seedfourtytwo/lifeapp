import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { CollapseChevron, Collapsible } from '../Collapsible';
import QuietText from '../QuietText';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

type Props = {
  title: string;
  description?: string;
  /**
   * A collapsible section is a plain row — its name on the left, what it is
   * set to on the right — that opens its controls in place. A fixed section
   * is a caption over its fields.
   */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** What a collapsible row is set to now: a word, or a small glyph. */
  value?: React.ReactNode;
  /**
   * Opens a collapsed section each time this changes to something — the
   * problem Save found inside it, which nobody could see while it was shut.
   */
  openFor?: object | null;
  children: React.ReactNode;
};

const ROW_MIN_HEIGHT = 56;

export default function FormSection({
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  value,
  openFor = null,
  children,
}: Props) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (openFor) setCollapsed(false);
  }, [openFor]);

  if (!collapsible) {
    return (
      <View style={formSectionStyles.section}>
        <QuietText style={typeScale.caption}>{title}</QuietText>
        {description ? (
          <QuietText style={[typeScale.caption, formSectionStyles.hint]}>{description}</QuietText>
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <View style={formSectionStyles.section}>
      <Pressable
        onPress={() => setCollapsed((open) => !open)}
        style={formSectionStyles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
      >
        <Text
          style={[typeScale.rowName, formSectionStyles.rowTitle, { color: theme.colors.onSurface }]}
        >
          {title}
        </Text>
        {typeof value === 'string' ? (
          <QuietText style={[typeScale.secondary, formSectionStyles.rowValue]} numberOfLines={2}>
            {value}
          </QuietText>
        ) : (
          <View style={formSectionStyles.rowGlyph}>{value}</View>
        )}
        <CollapseChevron open={!collapsed} size={20} color={theme.colors.onSurfaceVariant} />
      </Pressable>
      <Collapsible open={!collapsed} contentStyle={formSectionStyles.openBody}>
        {description ? (
          <QuietText style={[typeScale.caption, formSectionStyles.hint]}>{description}</QuietText>
        ) : null}
        {children}
      </Collapsible>
    </View>
  );
}

/** One red line under a control that is not a text field — a row of chips, a pair of times. */
export function FieldProblemText({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={[typeScale.caption, { color: theme.colors.error }]}>{children}</Text>;
}

export const formSectionStyles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: ROW_MIN_HEIGHT,
  },
  rowTitle: {
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  rowGlyph: {
    flex: 1,
    alignItems: 'flex-end',
  },
  openBody: {
    gap: space.md,
    paddingBottom: space.sm,
  },
  sectionBody: {
    gap: space.md,
  },
  /** Layout only — hints take their colour from QuietText. */
  hint: {
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 48,
  },
  switchLabel: {
    flex: 1,
    gap: space.xxs,
  },
  timeRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  timeField: {
    flex: 1,
  },
});
