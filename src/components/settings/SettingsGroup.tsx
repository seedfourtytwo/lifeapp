import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import Rule from '../Rule';
import { settingsRowStyles } from './SettingsRow';

type Props = {
  title?: string;
  caption?: string;
  children: React.ReactNode;
};

export default function SettingsGroup({ title, caption, children }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
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
              borderRadius: deco.radius.lg,
            },
          ]}
          elevation={0}
        >
          {items.map((child, index) => (
            <React.Fragment key={index}>
              {index > 0 ? (
                <Rule style={styles.separator} />
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
    gap: space.sm,
  },
  title: {
    paddingHorizontal: space.sm,
  },
  surface: {
    overflow: 'hidden',
  },
  /** Inset to where the row's title starts, so glyphs read as one column. */
  separator: {
    marginLeft: space.lg + settingsRowStyles.iconSlot.width + space.lg,
  },
  caption: {
    paddingHorizontal: space.sm,
    lineHeight: 18,
  },
});
