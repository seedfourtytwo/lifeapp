import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, Surface, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';

type Props = {
  title?: string;
  caption?: string;
  children: React.ReactNode;
};

export default function SettingsGroup({ title, caption, children }: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.wrap}>
      {title ? (
        <Text
          variant="labelLarge"
          style={[styles.title, { color: theme.colors.onSurfaceVariant }]}
        >
          {title}
        </Text>
      ) : null}
      {items.length > 0 ? (
        <Surface
          style={[
            styles.surface,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              borderRadius: deco.radius.md,
              borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
            },
          ]}
          elevation={0}
        >
          {items.map((child, index) => (
            <React.Fragment key={index}>
              {index > 0 ? (
                <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
              ) : null}
              {child}
            </React.Fragment>
          ))}
        </Surface>
      ) : null}
      {caption ? (
        <Text
          variant="bodySmall"
          style={[styles.caption, { color: theme.colors.onSurfaceVariant }]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  title: {
    paddingHorizontal: 8,
  },
  surface: {
    overflow: 'hidden',
  },
  caption: {
    paddingHorizontal: 8,
    lineHeight: 18,
  },
});
