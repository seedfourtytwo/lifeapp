import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentType } from 'react';
import {
  isCustomTrackerIconId,
  type CustomTrackerIconId,
  type TrackerIconId,
} from '../../protocol';
import { PullUpIcon, PushUpIcon } from './customTrackerIcons';

type CustomIconProps = {
  size?: number;
  color?: string;
};

const CUSTOM_ICON_RENDERERS: Record<
  CustomTrackerIconId,
  ComponentType<CustomIconProps>
> = {
  'push-up': PushUpIcon,
  'pull-up': PullUpIcon,
};

type Props = {
  name: TrackerIconId;
  size?: number;
  color: string;
};

/**
 * Renders a curated tracker icon — MCI glyph or local custom SVG.
 */
export function TrackerIcon({ name, size = 22, color }: Props) {
  if (isCustomTrackerIconId(name)) {
    const CustomIcon = CUSTOM_ICON_RENDERERS[name];
    return <CustomIcon size={size} color={color} />;
  }

  return (
    <MaterialCommunityIcons
      name={name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={size}
      color={color}
    />
  );
}
