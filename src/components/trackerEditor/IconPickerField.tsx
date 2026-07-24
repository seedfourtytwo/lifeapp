import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  TRACKER_ICON_FEATURED_IDS,
  TRACKER_ICON_MORE_IDS,
  isFeaturedTrackerIconId,
  type TrackerIconId,
} from '../../protocol';
import { TrackerIcon } from '../trackerIcons/TrackerIcon';
import FormSection, { formSectionStyles } from './FormSection';

type Props = {
  value: TrackerIconId | null;
  onChange: (icon: TrackerIconId | null) => void;
};

type CellProps = {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  selectedBorder: string;
  idleBorder: string;
  selectedBg: string;
  surface: string;
};

function IconPickerCell({
  selected,
  onPress,
  accessibilityLabel,
  children,
  selectedBorder,
  idleBorder,
  selectedBg,
  surface,
}: CellProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        {
          borderColor: selected ? selectedBorder : idleBorder,
          backgroundColor: selected ? selectedBg : surface,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

export default function IconPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [expanded, setExpanded] = useState(false);

  const selectedBorder = theme.colors.primary;
  const idleBorder = theme.colors.outlineVariant;
  const selectedBg = `${theme.colors.primary}18`;
  const surface = theme.colors.surface;

  const visibleIds = useMemo(() => {
    const featured = [...TRACKER_ICON_FEATURED_IDS];
    if (!expanded) {
      if (value && !isFeaturedTrackerIconId(value)) {
        return [value, ...featured.filter((id) => id !== value)];
      }
      return featured;
    }
    return [...featured, ...TRACKER_ICON_MORE_IDS];
  }, [expanded, value]);

  const cellChrome = {
    selectedBorder,
    idleBorder,
    selectedBg,
    surface,
  };

  return (
    <FormSection
      title={t('editor.iconSectionTitle')}
      description={t('editor.iconSectionDescription')}
      collapsible
      defaultCollapsed
    >
      <View style={styles.grid}>
        <IconPickerCell
          selected={value === null}
          onPress={() => onChange(null)}
          accessibilityLabel={t('editor.iconNoneA11y')}
          {...cellChrome}
        >
          <View
            style={[
              styles.noneSlash,
              {
                backgroundColor:
                  value === null ? theme.colors.primary : theme.colors.onSurfaceVariant,
              },
            ]}
          />
        </IconPickerCell>

        {visibleIds.map((iconId) => {
          const selected = value === iconId;
          return (
            <IconPickerCell
              key={iconId}
              selected={selected}
              onPress={() => onChange(iconId)}
              accessibilityLabel={t('editor.iconChoiceA11y', { icon: iconId })}
              {...cellChrome}
            >
              <TrackerIcon
                name={iconId}
                size={22}
                color={selected ? theme.colors.primary : theme.colors.onSurface}
              />
            </IconPickerCell>
          );
        })}
      </View>

      <Button
        mode="text"
        compact
        icon={expanded ? 'chevron-up' : 'chevron-down'}
        onPress={() => setExpanded((current) => !current)}
        style={styles.moreButton}
      >
        {expanded ? t('editor.iconShowLess') : t('editor.iconShowMore')}
      </Button>
    </FormSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    ...formSectionStyles.chipRow,
    marginTop: 4,
  },
  cell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  noneSlash: {
    width: 18,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-35deg' }],
  },
  moreButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginLeft: -8,
  },
});
