import React from 'react';
import { IconButton, useTheme } from 'react-native-paper';

type Props = {
  hasNote: boolean;
  onPress: () => void;
  /** Accessibility noun, e.g. "note" or "journal". */
  accessibilityNoun?: string;
  size?: number;
  style?: object;
};

/** Compact note/journal affordance for cards and Home. */
export function NoteIconButton({
  hasNote,
  onPress,
  accessibilityNoun = 'note',
  size = 18,
  style,
}: Props) {
  const theme = useTheme();
  return (
    <IconButton
      icon={hasNote ? 'note-text-outline' : 'note-plus-outline'}
      size={size}
      onPress={onPress}
      iconColor={hasNote ? theme.colors.primary : theme.colors.onSurfaceVariant}
      accessibilityLabel={hasNote ? `Edit ${accessibilityNoun}` : `Add ${accessibilityNoun}`}
      style={[{ margin: 0 }, style]}
      hitSlop={8}
    />
  );
}
