import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { typeScale } from '../theme/typography';

/**
 * The badge is pinned to the corner of a 44pt identity mark, so it has nowhere
 * to grow into. Past about 1.3x the digits escape the well; the inline variant
 * sits in a normal row and is left to scale freely.
 */
const BADGE_MAX_FONT_SCALE = 1.3;

type Props = {
  days: number;
  color: string;
  /** Compact badge on the identity mark vs inline after a text title. */
  variant: 'badge' | 'inline';
  /** Badge well / border (badge variant only). */
  badgeBackgroundColor?: string;
  badgeBorderColor?: string;
};

/**
 * Shared fire + day-count chip for Home streak display.
 */
export function StreakFireCount({
  days,
  color,
  variant,
  badgeBackgroundColor,
  badgeBorderColor,
}: Props) {
  if (variant === 'inline') {
    return (
      <View
        style={styles.inline}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialCommunityIcons name="fire" size={16} color={color} />
        <Text variant="labelLarge" style={[styles.countInline, { color }]}>
          {days}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeBackgroundColor,
          borderColor: badgeBorderColor,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons name="fire" size={11} color={color} />
      <Text
        variant="labelSmall"
        style={[styles.countBadge, { color }]}
        maxFontSizeMultiplier={BADGE_MAX_FONT_SCALE}
      >
        {days}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  countInline: {
    ...typeScale.data,
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    // Geometric: half the height, so the badge stays a capsule.
    borderRadius: 8,
    borderWidth: 1.5,
    // Mono digits run a touch wider than the system font's.
    minWidth: 24,
    justifyContent: 'center',
  },
  countBadge: {
    ...typeScale.data,
    fontSize: 10,
    lineHeight: 12,
  },
});
