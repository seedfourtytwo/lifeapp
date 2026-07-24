import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';

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
      <Text variant="labelSmall" style={[styles.countBadge, { color }]}>
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    minWidth: 22,
    justifyContent: 'center',
  },
  countBadge: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 10,
    lineHeight: 12,
  },
});
