import React from 'react';
import { Text, type TextProps } from 'react-native';
import { nightColors, nightType } from './tokens';

type Props = TextProps & {
  kind: keyof typeof nightType;
  /** `dim` steps back by colour, never by opacity. */
  tone?: 'cream' | 'dim';
};

/** Text in one of the kit's type roles, in cream or dimmed cream. */
export function NightText({ kind, tone = 'cream', style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        nightType[kind],
        { color: tone === 'dim' ? nightColors.creamDim : nightColors.cream },
        style,
      ]}
    />
  );
}
