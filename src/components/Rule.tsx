import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';

type Props = { style?: StyleProp<ViewStyle> };

/**
 * A drawn 1dp line between rows that share one card or menu. Paper's Divider
 * is a sub-pixel hairline that renders as grey haze; groups that merely sit
 * apart are separated by space instead, not by this.
 */
export default function Rule({ style }: Props) {
  const theme = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.colors.outlineVariant }, style]} />;
}

const styles = StyleSheet.create({
  rule: { height: 1 },
});
