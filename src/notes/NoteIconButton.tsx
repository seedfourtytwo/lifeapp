import React from 'react';
import { IconButton, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StickyNoteMicIcon } from './StickyNoteMicIcon';

type Props = {
  hasNote: boolean;
  /** Tap: open and start dictation. */
  onPress: () => void;
  /** Long-press: open for edit without auto-dictation. */
  onLongPress?: () => void;
  /** Accessibility noun, e.g. "note" or "journal". */
  accessibilityNoun?: string;
  size?: number;
  style?: object;
};

/**
 * Home note affordance — sticky note + mic.
 * Tap to dictate; long-press to edit. Primary color when a note exists for today.
 */
export function NoteIconButton({
  hasNote,
  onPress,
  onLongPress,
  accessibilityNoun,
  size = 22,
  style,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const noun = accessibilityNoun ?? t('note.noteNoun');
  const color = hasNote ? theme.colors.primary : theme.colors.onSurfaceVariant;
  return (
    <IconButton
      icon={({ size: iconSize }) => (
        <StickyNoteMicIcon size={iconSize} color={color} />
      )}
      size={size}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityLabel={
        hasNote
          ? t('note.dictateAccessible', { noun })
          : t('note.dictateNewAccessible', { noun })
      }
      accessibilityHint={onLongPress ? t('note.dictateHint') : undefined}
      style={[{ margin: 0 }, style]}
      hitSlop={8}
    />
  );
}
