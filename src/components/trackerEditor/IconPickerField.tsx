import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  TRACKER_ICON_IDS,
  type TrackerIconId,
} from '../../protocol';
import FormSection, { formSectionStyles } from './FormSection';

type Props = {
  value: TrackerIconId | null;
  onChange: (icon: TrackerIconId | null) => void;
};

export default function IconPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');

  const selectedBorder = theme.colors.primary;
  const idleBorder = theme.colors.outlineVariant;
  const selectedBg = `${theme.colors.primary}18`;

  return (
    <FormSection
      title={t('editor.iconSectionTitle')}
      description={t('editor.iconSectionDescription')}
    >
      <View style={styles.grid}>
        <Pressable
          onPress={() => onChange(null)}
          style={({ pressed }) => [
            styles.cell,
            {
              borderColor: value === null ? selectedBorder : idleBorder,
              backgroundColor: value === null ? selectedBg : theme.colors.surface,
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === null }}
          accessibilityLabel={t('editor.iconNoneA11y')}
        >
          <MaterialCommunityIcons
            name="close"
            size={22}
            color={value === null ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
        </Pressable>

        {TRACKER_ICON_IDS.map((iconId) => {
          const selected = value === iconId;
          return (
            <Pressable
              key={iconId}
              onPress={() => onChange(iconId)}
              style={({ pressed }) => [
                styles.cell,
                {
                  borderColor: selected ? selectedBorder : idleBorder,
                  backgroundColor: selected ? selectedBg : theme.colors.surface,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('editor.iconChoiceA11y', { icon: iconId })}
            >
              <MaterialCommunityIcons
                name={iconId}
                size={22}
                color={selected ? theme.colors.primary : theme.colors.onSurface}
              />
            </Pressable>
          );
        })}
      </View>
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
  },
  pressed: {
    opacity: 0.7,
  },
});
