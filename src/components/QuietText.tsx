import React from 'react';
import { Text, useTheme } from 'react-native-paper';

type Props = React.ComponentProps<typeof Text>;

/**
 * Secondary text — captions, hints, empty states.
 *
 * Text is muted by *choosing* the muted token, never by lowering opacity over
 * it. The two compound: `opacity: 0.6` over `onSurfaceVariant` lands near
 * 2.2:1, well under the 4.5:1 floor, and it did so in every theme. The tokens
 * in `src/theme/themes.ts` are picked to pass at full strength, and
 * `__tests__/themeContrast.test.ts` holds them there.
 *
 * The colour goes first in the style array so a caller can still override it —
 * an accented hint, say — while the default costs nobody a thought.
 */
export default function QuietText({ style, ...rest }: Props) {
  const theme = useTheme();
  return <Text {...rest} style={[{ color: theme.colors.onSurfaceVariant }, style]} />;
}
