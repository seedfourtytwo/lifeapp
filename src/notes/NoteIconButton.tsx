import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { StickyNoteMicIcon } from './StickyNoteMicIcon';

/** The count capsule's floor, and half of it is its radius. One or two digits. */
const BADGE_HEIGHT = 14;

type Props = {
  hasNote: boolean;
  /**
   * Chapters written in this notebook today. Badged from two upwards — one is
   * what the aura already says, and a "1" on every notebook is just noise.
   */
  entryCount?: number;
  /** Tap: open and start dictation. */
  onPress: () => void;
  /** Long-press: open for edit without auto-dictation. */
  onLongPress?: () => void;
  /** Accessibility noun, e.g. "note" or notebook name. */
  accessibilityNoun?: string;
  size?: number;
  style?: object;
  /** Notebook identity color — always full strength. */
  accentColor?: string;
  /** Optional tracker-library icon; default is the sticky-note+mic glyph. */
  icon?: TrackerIconId;
};

/**
 * Home note affordance — sticky note + mic, or a tinted catalog icon.
 * Tap to dictate; long-press to edit. A discrete aura marks “has text today”.
 */
export function NoteIconButton({
  hasNote,
  entryCount = 0,
  onPress,
  onLongPress,
  accessibilityNoun,
  size = 22,
  style,
  accentColor,
  icon,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { t: tj } = useTranslation('journal');
  const noun = accessibilityNoun ?? t('note.noteNoun');
  const idle = theme.colors.onSurfaceVariant;
  const glyphColor = accentColor ?? (hasNote ? theme.colors.primary : idle);
  const auraColor = accentColor ?? theme.colors.primary;
  const box = size + 16;
  const auraBox = size + 10;
  const showCount = entryCount > 1;
  const baseLabel = hasNote
    ? t('note.dictateAccessible', { noun })
    : t('note.dictateNewAccessible', { noun });
  const label = showCount
    ? `${baseLabel}. ${tj('chapters.countA11y', { count: entryCount })}`
    : baseLabel;

  return (
    <View style={[noteIconButtonStyles.wrap, { width: box, height: box }, style]}>
      {hasNote ? (
        <View
          pointerEvents="none"
          style={[
            noteIconButtonStyles.aura,
            {
              width: auraBox,
              height: auraBox,
              borderRadius: auraBox / 2,
              backgroundColor: auraColor,
              marginLeft: -auraBox / 2,
              marginTop: -auraBox / 2,
            },
          ]}
        />
      ) : null}
      <IconButton
        icon={({ size: iconSize }) =>
          icon ? (
            <TrackerIcon name={icon} size={iconSize} color={glyphColor} />
          ) : (
            <StickyNoteMicIcon size={iconSize} color={glyphColor} />
          )
        }
        size={size}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityLabel={label}
        accessibilityHint={onLongPress ? t('note.dictateHint') : undefined}
        style={noteIconButtonStyles.button}
        hitSlop={8}
      />
      {showCount ? (
        <View
          pointerEvents="none"
          style={[
            noteIconButtonStyles.badge,
            {
              backgroundColor: auraColor,
              borderColor: theme.colors.surface,
              // Geometry, not a chosen corner: half the badge's height is what
              // makes it a capsule rather than a rounded square.
              borderRadius: BADGE_HEIGHT / 2,
            },
          ]}
        >
          <Text
            variant="labelSmall"
            // Pinned to a corner of a fixed touch target: growing it with the
            // system font would push the count off the glyph entirely.
            maxFontSizeMultiplier={1.2}
            style={[noteIconButtonStyles.badgeText, { color: theme.colors.surface }]}
          >
            {entryCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Exported so `fontScaling.test.ts` can hold the count capsule to the rules. */
export const noteIconButtonStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    opacity: 0.18,
  },
  button: {
    margin: 0,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: BADGE_HEIGHT,
    minHeight: BADGE_HEIGHT,
    paddingHorizontal: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
