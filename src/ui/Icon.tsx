import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { iconSize, toneColor, type IconSize, type NightTone } from './tokens';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: IconSize | number;
  tone?: NightTone;
};

/**
 * The one way the kit draws a glyph: the icon font the app already uses,
 * sized by token and painted in a tone. Decorative by default: whatever
 * holds it says what it means.
 */
export function Icon({ name, size = 'md', tone = 'cream' }: Props) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={typeof size === 'number' ? size : iconSize[size]}
      color={toneColor(tone)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
