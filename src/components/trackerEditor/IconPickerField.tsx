import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  TRACKER_ICON_IDS,
  iconIdMatchesQuery,
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

/**
 * Memoized: a keystroke in the editor's name field re-renders the dialog, and
 * these props are referentially stable, so re-rendering here is pure waste that
 * used to starve the name TextInput. See __tests__/trackerEditorRerender.test.ts.
 */
function IconPickerField({ value, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const [query, setQuery] = useState('');

  const selectedBorder = theme.colors.primary;
  const idleBorder = theme.colors.outlineVariant;
  const selectedBg = `${theme.colors.primary}18`;
  const surface = theme.colors.surface;
  const searching = query.trim().length > 0;

  const visibleIds = useMemo(
    () => TRACKER_ICON_IDS.filter((id) => iconIdMatchesQuery(id, query)),
    [query],
  );

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
      <TextInput
        mode="outlined"
        dense
        value={query}
        onChangeText={setQuery}
        placeholder={t('editor.iconSearchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={t('editor.iconSearchPlaceholder')}
        style={styles.search}
      />

      <ScrollView
        style={styles.gridScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={visibleIds.length > 12}
      >
        <View style={styles.grid}>
          {!searching ? (
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
          ) : null}

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
      </ScrollView>

      {searching && visibleIds.length === 0 ? (
        <Text variant="bodySmall" style={styles.empty}>
          {t('editor.iconSearchEmpty')}
        </Text>
      ) : null}
    </FormSection>
  );
}

const styles = StyleSheet.create({
  search: {
    marginTop: 4,
    marginBottom: 8,
  },
  gridScroll: {
    maxHeight: 280,
  },
  grid: {
    ...formSectionStyles.chipRow,
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
  empty: {
    opacity: 0.65,
    marginTop: 8,
  },
});

export default React.memo(IconPickerField);
