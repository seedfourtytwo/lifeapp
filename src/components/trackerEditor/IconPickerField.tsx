import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import QuietText from '../QuietText';
import { FilledField } from '../sheet';
import { typeScale } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import {
  TRACKER_ICON_IDS,
  iconIdMatchesQuery,
  type TrackerIconId,
} from '../../protocol';
import { TrackerIcon } from '../trackerIcons/TrackerIcon';
import FormSection, { formSectionStyles } from './FormSection';
import { useAppTheme } from '../../hooks/useAppTheme';

type Props = {
  value: TrackerIconId | null;
  onChange: (icon: TrackerIconId | null) => void;
};

type CellProps = {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  selectedBg: string;
  idleBg: string;
  radius: number;
};

function IconPickerCell({
  selected,
  onPress,
  accessibilityLabel,
  children,
  selectedBg,
  idleBg,
  radius,
}: CellProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        {
          borderRadius: radius,
          backgroundColor: selected ? selectedBg : idleBg,
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
  const { decorations: deco } = useAppTheme();
  const { t } = useTranslation('trackers');
  const [query, setQuery] = useState('');


  const searching = query.trim().length > 0;

  const visibleIds = useMemo(
    () => TRACKER_ICON_IDS.filter((id) => iconIdMatchesQuery(id, query)),
    [query],
  );

  const cellChrome = {
    selectedBg: theme.colors.primary,
    idleBg: theme.colors.background,
    radius: deco.radius.md,
  };

  return (
    <FormSection
      title={t('editor.iconSectionTitle')}
      description={t('editor.iconSectionDescription')}
      collapsible
      defaultCollapsed
      value={
        value ? (
          <TrackerIcon name={value} size={22} color={theme.colors.onSurface} />
        ) : (
          <QuietText style={typeScale.secondary}>{t('editor.iconNone')}</QuietText>
        )
      }
    >
      <FilledField
        value={query}
        onChangeText={setQuery}
        placeholder={t('editor.iconSearchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
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
                      value === null ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
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
                  color={selected ? theme.colors.onPrimary : theme.colors.onSurface}
                />
              </IconPickerCell>
            );
          })}
        </View>
      </ScrollView>

      {searching && visibleIds.length === 0 ? (
        <QuietText style={typeScale.caption}>
          {t('editor.iconSearchEmpty')}
        </QuietText>
      ) : null}
    </FormSection>
  );
}

const styles = StyleSheet.create({
  gridScroll: {
    maxHeight: 280,
  },
  grid: {
    ...formSectionStyles.chipRow,
  },
  cell: {
    width: 44,
    height: 44,
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
});

export default React.memo(IconPickerField);
