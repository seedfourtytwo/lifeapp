import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentType } from 'react';
import {
  isCustomTrackerIconId,
  type CustomTrackerIconId,
  type TrackerIconId,
} from '../../protocol';
import { PullUpIcon, PushUpIcon } from './customTrackerIcons';
import { trackerGlyphName } from './trackerGlyph';

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
  /** 22 inside a disc, 24 on its own. */
  size?: number;
  color: string;
  /** The filled glyph, for a done state. At rest a tracker draws its outline twin. */
  filled?: boolean;
};

/**
 * Renders a curated tracker icon (MCI glyph or local SVG for custom ids).
 */
export function TrackerIcon({ name, size = 22, color, filled = false }: Props) {
  if (isCustomTrackerIconId(name)) {
    const CustomIcon = CUSTOM_ICON_RENDERERS[name];
    return <CustomIcon size={size} color={color} />;
  }

  return (
    <MaterialCommunityIcons name={trackerGlyphName(name, filled)} size={size} color={color} />
  );
}
