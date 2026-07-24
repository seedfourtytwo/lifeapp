import React from 'react';
import Svg, { Circle, Line, type SvgProps } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
} & Omit<SvgProps, 'width' | 'height' | 'viewBox' | 'children'>;

/** Straight geometric push-up stickman — local SVG (MCI has no push-up glyph). */
export function PushUpIcon({ size = 22, color = '#000', ...rest }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden {...rest}>
      {/* Floor */}
      <Line
        x1="2"
        y1="20"
        x2="22"
        y2="20"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      {/* Body + legs as one thick diagonal bar (feet left → shoulders right) */}
      <Line
        x1="4.5"
        y1="19.2"
        x2="16.2"
        y2="8.6"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      {/* Locked-out arm down to the floor */}
      <Line
        x1="14.2"
        y1="10.2"
        x2="12.2"
        y2="19.2"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      {/* Head */}
      <Circle cx="18.2" cy="6.6" r="2.35" fill={color} />
    </Svg>
  );
}

/** Hang from bar — same geometric stickman language as PushUpIcon. */
export function PullUpIcon({ size = 22, color = '#000', ...rest }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden {...rest}>
      {/* Bar */}
      <Line
        x1="2"
        y1="4.5"
        x2="22"
        y2="4.5"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      {/* Arms: bar → shoulder junction */}
      <Line
        x1="6.5"
        y1="4.5"
        x2="12"
        y2="12"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Line
        x1="17.5"
        y1="4.5"
        x2="12"
        y2="12"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      {/* Torso + legs */}
      <Line
        x1="12"
        y1="12"
        x2="12"
        y2="20.2"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      {/* Head last so it sits cleanly between bar and shoulders */}
      <Circle cx="12" cy="8.4" r="2.35" fill={color} />
    </Svg>
  );
}
