import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from 'react-native-paper';

type Props = Omit<SwitchProps, 'trackColor' | 'thumbColor'>;

/**
 * A switch in the house colours: moss when on, the outline tone when off.
 *
 * Paper's Switch paints Material 2's half-transparent track and a coloured
 * thumb, and on web falls back to react-native-web's teal for the thumb. The
 * off track is the outline tone rather than the well: on a day tile the well
 * is close to invisible, and a switch has to show where it is when it is off.
 */
export default function SettingsSwitch({ value, ...rest }: Props) {
  const theme = useTheme();
  const thumbOn = theme.colors.onPrimary;
  const thumbOff = theme.dark ? theme.colors.onSurfaceVariant : theme.colors.surface;
  // react-native-web reads the on-thumb from its own prop, not `thumbColor`.
  const web = { activeThumbColor: thumbOn };

  return (
    <Switch
      value={value}
      trackColor={{ true: theme.colors.primary, false: theme.colors.outline }}
      thumbColor={value ? thumbOn : thumbOff}
      ios_backgroundColor={theme.colors.outline}
      {...web}
      {...rest}
    />
  );
}
