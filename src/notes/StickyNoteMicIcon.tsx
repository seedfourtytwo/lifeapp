import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = {
  size: number;
  color: string;
};

/**
 * Sticky-note outline with a small mic glyph — note + dictate affordance.
 */
export function StickyNoteMicIcon({ size, color }: Props) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
      {/* Sticky note body */}
      <Path
        d="M6 3.5h9.5L20 8v11.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 19.5v-14A1.5 1.5 0 0 1 6.5 4"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      {/* Folded corner */}
      <Path
        d="M15.5 3.5V7a1 1 0 0 0 1 1h3.5"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      {/* Mic capsule */}
      <Rect
        x={10.25}
        y={9.5}
        width={3.5}
        height={5}
        rx={1.75}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Mic stand */}
      <Path
        d="M9.5 15.25a2.5 2.5 0 0 0 5 0M12 17.75v1.5"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
