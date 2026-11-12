import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider } from './Divider';
import { GlassSurface } from './GlassSurface';
import { NightText } from './NightText';
import { space } from './tokens';

type Props = {
  /** A quiet label over the content: "Morning", "Days". Leave it off when the content says enough. */
  label?: string;
  /** Puts the children in one glass group, a divider between each: a block of Settings rows. */
  grouped?: boolean;
  children: React.ReactNode;
};

/** A quiet label and what it heads. */
export function Section({ label, grouped = false, children }: Props) {
  const items = React.Children.toArray(children);
  return (
    <View style={sectionStyles.section}>
      {label ? (
        <NightText kind="caption" tone="dim" accessibilityRole="header" style={sectionStyles.label}>
          {label}
        </NightText>
      ) : null}
      {grouped ? (
        <GlassSurface size="tile" style={sectionStyles.group}>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 ? <Divider /> : null}
              {item}
            </React.Fragment>
          ))}
        </GlassSurface>
      ) : (
        items
      )}
    </View>
  );
}

export const sectionStyles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    paddingHorizontal: space.sm,
  },
  group: {
    paddingVertical: 0,
  },
});
