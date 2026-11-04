import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import SettingsSwitch from './SettingsSwitch';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = {
  icon?: IconName;
  left?: React.ReactNode;
  iconColor?: string;
  title: string;
  description?: string;
  trailingValue?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  switchValue?: boolean;
  onSwitch?: (value: boolean) => void;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
};

export default function SettingsRow({
  icon = 'circle-outline',
  left,
  iconColor,
  title,
  description,
  trailingValue,
  trailing,
  chevron = false,
  selected = false,
  switchValue,
  onSwitch,
  onPress,
  disabled = false,
  busy = false,
  destructive = false,
  accessibilityHint,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const interactive = Boolean(onPress || onSwitch);
  const isSwitch = onSwitch != null && switchValue !== undefined;
  // A bare glyph, not a tinted well: the row's words carry it, and a column of
  // coloured tiles down a settings list only added noise.
  const glyphColor =
    iconColor ?? (destructive ? theme.colors.error : theme.colors.onSurfaceVariant);

  const handlePress = () => {
    if (disabled || busy) return;
    if (onPress) {
      onPress();
      return;
    }
    if (onSwitch && switchValue !== undefined) {
      onSwitch(!switchValue);
    }
  };

  return (
    <Pressable
      onPress={interactive ? handlePress : undefined}
      disabled={disabled || busy}
      accessibilityRole={isSwitch ? 'switch' : interactive ? 'button' : undefined}
      accessibilityState={
        isSwitch
          ? { checked: switchValue, disabled: disabled || busy }
          : { disabled: disabled || busy, selected: selected || undefined }
      }
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        // A wash of the well under the whole row, not a fade of its words.
        interactive && pressed && !disabled && !busy
          ? { backgroundColor: theme.colors.surfaceVariant }
          : null,
        disabled || busy ? styles.disabled : null,
      ]}
    >
      {left ?? (
        <View style={styles.iconSlot}>
          <MaterialCommunityIcons name={icon} size={24} color={glyphColor} />
        </View>
      )}
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            { color: destructive ? theme.colors.error : theme.colors.onSurface },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            numberOfLines={2}
            style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailingValue ? (
        <Text
          numberOfLines={1}
          style={[styles.trailingValue, { color: theme.colors.onSurfaceVariant }]}
        >
          {trailingValue}
        </Text>
      ) : null}
      {trailing ? (
        <View onStartShouldSetResponder={() => true}>{trailing}</View>
      ) : null}
      {busy ? (
        <ActivityIndicator size={20} color={theme.colors.primary} />
      ) : isSwitch ? (
        <View pointerEvents="none">
          <SettingsSwitch value={switchValue} onValueChange={onSwitch} accessible={false} />
        </View>
      ) : selected ? (
        <MaterialCommunityIcons name="check" size={22} color={theme.colors.primary} />
      ) : chevron ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      ) : null}
    </Pressable>
  );
}

/** The left column every row's glyph sits in, so titles line up down a group. */
export const settingsRowStyles = StyleSheet.create({
  iconSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  iconSlot: settingsRowStyles.iconSlot,
  text: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  title: {
    ...typeScale.body,
  },
  description: {
    ...typeScale.secondary,
  },
  trailingValue: {
    ...typeScale.secondary,
    flexShrink: 1,
    maxWidth: 120,
    textAlign: 'right',
  },
});
