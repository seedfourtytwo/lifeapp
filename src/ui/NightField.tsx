import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { space } from '../theme/spacing';
import { nightColors, nightRadius, nightType, QUIET_STROKE } from './tokens';

/** One line of text typed onto the night: a plain edge, cream words, a dimmed hint. */
export function NightField(props: Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'multiline'>) {
  return (
    <TextInput
      {...props}
      multiline={false}
      style={nightFieldStyles.field}
      placeholderTextColor={nightColors.creamDim}
      selectionColor={nightColors.cream}
      cursorColor={nightColors.cream}
    />
  );
}

export const nightFieldStyles = StyleSheet.create({
  field: {
    ...nightType.body,
    color: nightColors.cream,
    minHeight: 56,
    borderRadius: nightRadius.field,
    borderWidth: QUIET_STROKE,
    borderColor: nightColors.quietEdge,
    backgroundColor: nightColors.glassMiddle,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
