import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Switch, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = {
  icon?: IconName;
  left?: React.ReactNode;
  wellColor?: string;
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
  wellColor,
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
  const { decorations: deco, isCartoon } = useAppTheme();
  const interactive = Boolean(onPress || onSwitch);
  const isSwitch = onSwitch != null && switchValue !== undefined;
  const wellBg =
    wellColor ?? (destructive ? theme.colors.errorContainer : theme.colors.primaryContainer);
  const glyphColor =
    iconColor ?? (destructive ? theme.colors.error : theme.colors.onPrimaryContainer);

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
        interactive && pressed && !disabled && !busy ? styles.pressed : null,
        disabled || busy ? styles.disabled : null,
      ]}
    >
      {left ?? (
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: wellBg,
              borderRadius: isCartoon ? deco.radius.sm : 12,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={22} color={glyphColor} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailingValue ? (
        <Text
          variant="bodyMedium"
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
          <Switch value={switchValue} onValueChange={onSwitch} accessible={false} />
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

export const settingsRowStyles = StyleSheet.create({
  iconWell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  iconWell: settingsRowStyles.iconWell,
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    marginBottom: 0,
  },
  trailingValue: {
    flexShrink: 1,
    maxWidth: 120,
    textAlign: 'right',
  },
});
