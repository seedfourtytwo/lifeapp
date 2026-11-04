import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { withAlpha } from '../utils/color';
import { StickyNoteMicIcon } from './StickyNoteMicIcon';

/** The count capsule's floor, and half of it is its radius. One or two digits. */
const BADGE_HEIGHT = 14;
/** The touch target, and the round press wash that fills it. */
const TARGET = 48;
/** A notebook's colour mark; half of it is its radius. */
const DOT = 7;
/** The ring of page ground that lifts the dot off the glyph. */
const DOT_RING = 2;
/** Ink at 8%: the press wash, sized to the button. */
const PRESS_WASH_ALPHA = 0.08;

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
  /**
   * A notebook's identity colour, shown only as a small dot on the icon. The
   * glyph itself stays ink, like every other icon.
   */
  dotColor?: string;
  /** Optional tracker-library icon; default is the sticky-note+mic glyph. */
  icon?: TrackerIconId;
};

/**
 * Home note affordance — sticky note + mic, or a catalog icon, in ink.
 * Tap to dictate; long-press to edit. A quiet well behind a darker glyph marks
 * “has text today”.
 */
export function NoteIconButton({
  hasNote,
  entryCount = 0,
  onPress,
  onLongPress,
  accessibilityNoun,
  size = 22,
  style,
  dotColor,
  icon,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { t: tj } = useTranslation('journal');
  const noun = accessibilityNoun ?? t('note.noteNoun');
  const glyphColor = hasNote ? theme.colors.onSurface : theme.colors.onSurfaceVariant;
  const wellBox = size + 14;
  const showCount = entryCount > 1;
  const baseLabel = hasNote
    ? t('note.dictateAccessible', { noun })
    : t('note.dictateNewAccessible', { noun });
  const label = showCount
    ? `${baseLabel}. ${tj('chapters.countA11y', { count: entryCount })}`
    : baseLabel;

  return (
    <View style={[noteIconButtonStyles.wrap, style]}>
      {hasNote ? (
        <View
          pointerEvents="none"
          style={[
            noteIconButtonStyles.well,
            {
              width: wellBox,
              height: wellBox,
              // Geometry: half the box is what makes the well a circle.
              borderRadius: wellBox / 2,
              backgroundColor: theme.colors.surfaceVariant,
              marginLeft: -wellBox / 2,
              marginTop: -wellBox / 2,
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
        rippleColor={withAlpha(theme.colors.onSurface, PRESS_WASH_ALPHA)}
        style={noteIconButtonStyles.button}
      />
      {dotColor ? (
        <View
          testID="notebook-dot"
          pointerEvents="none"
          style={[
            noteIconButtonStyles.dot,
            { backgroundColor: dotColor, borderColor: theme.colors.background },
          ]}
        />
      ) : null}
      {showCount ? (
        <View
          pointerEvents="none"
          style={[
            noteIconButtonStyles.badge,
            {
              backgroundColor: theme.colors.onSurface,
              borderColor: theme.colors.background,
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
    width: TARGET,
    height: TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  well: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  button: {
    margin: 0,
    width: TARGET,
    height: TARGET,
    // Geometry: half the target, so the press wash is a circle the button's size.
    borderRadius: TARGET / 2,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    // The ring is drawn inside the box, so the box grows by it on both sides.
    width: DOT + DOT_RING * 2,
    height: DOT + DOT_RING * 2,
    borderRadius: DOT / 2 + DOT_RING,
    borderWidth: DOT_RING,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
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
