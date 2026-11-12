import React from 'react';
import { Text, type TextProps } from 'react-native';
import { nightType, toneColor, type NightTone, type NightTypeRole } from './tokens';

type Props = TextProps & {
  kind: NightTypeRole;
  /** `dim` steps back by colour, never by opacity; a light only inside glass. */
  tone?: NightTone;
};

/** Text in one of the kit's type roles and tones. */
export function NightText({ kind, tone = 'cream', style, ...rest }: Props) {
  return <Text {...rest} style={[nightType[kind], { color: toneColor(tone) }, style]} />;
}
