import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_CLEAR_OPTIONS,
  clearOptionsAreEmpty,
  describeClearPlan,
  type ActivityClearPeriod,
  type ClearAppDataOptions,
} from '../db/clearDataPlan';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import ChoiceChip from './ChoiceChip';
import QuietText from './QuietText';
import { EditorSheet, FilledField, SheetCheck } from './sheet';

type PeriodChoice = 'all' | 'keep7' | 'keep30' | 'before';

interface Props {
  visible: boolean;
  busy: boolean;
  onDismiss: () => void;
  onConfirm: (options: ClearAppDataOptions) => void;
  onExportFirst?: () => void;
}

function periodFromChoice(choice: PeriodChoice, beforeDate: string): ActivityClearPeriod {
  switch (choice) {
    case 'keep7':
      return { kind: 'keepLastDays', days: 7 };
    case 'keep30':
      return { kind: 'keepLastDays', days: 30 };
    case 'before':
      return { kind: 'beforeDate', date: beforeDate.trim() };
    default:
      return { kind: 'all' };
  }
}

function choiceFromPeriod(period: ActivityClearPeriod): PeriodChoice {
  if (period.kind === 'keepLastDays') {
    return period.days === 7 ? 'keep7' : 'keep30';
  }
  if (period.kind === 'beforeDate') return 'before';
  return 'all';
}

export default function ClearDataSheet({
  visible,
  busy,
  onDismiss,
  onConfirm,
  onExportFirst,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const { decorations: deco } = useAppTheme();
  const [options, setOptions] = useState<ClearAppDataOptions>(DEFAULT_CLEAR_OPTIONS);
  const [beforeDate, setBeforeDate] = useState('');

  const periodOptions: { id: PeriodChoice; label: string }[] = [
    { id: 'all', label: t('clearData.period.all') },
    { id: 'keep7', label: t('clearData.period.keep7') },
    { id: 'keep30', label: t('clearData.period.keep30') },
    { id: 'before', label: t('clearData.period.before') },
  ];

  useEffect(() => {
    if (!visible) return;
    setOptions(DEFAULT_CLEAR_OPTIONS);
    setBeforeDate('');
  }, [visible]);

  const periodChoice = choiceFromPeriod(options.activityPeriod);
  const summary = useMemo(
    () =>
      describeClearPlan({
        ...options,
        activityPeriod: periodFromChoice(periodChoice, beforeDate),
      }),
    [beforeDate, options, periodChoice],
  );

  const nothingSelected = clearOptionsAreEmpty(options);
  const activityEnabled = options.activityHistory && !options.definitions;

  const toggle = (
    key: 'activityHistory' | 'calendar' | 'weather' | 'preferences' | 'definitions',
    value: boolean,
  ) => {
    setOptions((prev) => {
      if (key === 'definitions' && value) {
        return {
          ...prev,
          definitions: true,
          activityHistory: true,
          activityPeriod: { kind: 'all' },
        };
      }
      if (key === 'activityHistory' && !value && prev.definitions) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  const setPeriod = (choice: PeriodChoice) => {
    setOptions((prev) => ({
      ...prev,
      activityPeriod:
        choice === 'before'
          ? { kind: 'beforeDate', date: beforeDate.trim() }
          : periodFromChoice(choice, beforeDate),
    }));
  };

  const handleConfirm = () => {
    const next: ClearAppDataOptions = {
      ...options,
      activityPeriod: periodFromChoice(periodChoice, beforeDate),
    };
    if (next.definitions) {
      next.activityHistory = true;
      next.activityPeriod = { kind: 'all' };
    }
    if (
      next.activityHistory &&
      !next.definitions &&
      next.activityPeriod.kind === 'beforeDate' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(next.activityPeriod.date)
    ) {
      return;
    }
    onConfirm(next);
  };

  const beforeInvalid =
    activityEnabled &&
    periodChoice === 'before' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate.trim());

  return (
    <EditorSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!busy}
      title={t('clearData.title')}
      subtitle={t('clearData.subtitle')}
      primaryAction={{
        label: t('clearData.confirmButton'),
        onPress: handleConfirm,
        loading: busy,
        disabled: busy || nothingSelected || beforeInvalid,
        destructive: true,
      }}
    >
      {onExportFirst ? (
        <Button
          mode="outlined"
          icon="export"
          onPress={onExportFirst}
          disabled={busy}
          style={[styles.exportBtn, { borderRadius: deco.radius.pill }]}
        >
          {t('clearData.exportFirstButton')}
        </Button>
      ) : null}

      <View>
        <ScopeRow
          label={t('clearData.activityHistory.label')}
          description={t('clearData.activityHistory.description')}
          checked={options.activityHistory || options.definitions}
          disabled={options.definitions}
          onToggle={(v) => toggle('activityHistory', v)}
        />

        {activityEnabled ? (
          <View style={styles.periodBlock}>
            <QuietText style={typeScale.caption}>{t('clearData.period.label')}</QuietText>
            <View style={styles.chipRow}>
              {periodOptions.map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  selected={periodChoice === option.id}
                  onPress={() => setPeriod(option.id)}
                />
              ))}
            </View>
            {periodChoice === 'before' ? (
              <FilledField
                label={t('clearData.period.beforeDateLabel')}
                value={beforeDate}
                onChangeText={setBeforeDate}
                placeholder={t('clearData.period.beforeDatePlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                error={
                  beforeInvalid && beforeDate.trim().length > 0
                    ? t('clearData.period.beforeDateError')
                    : null
                }
              />
            ) : null}
            {periodChoice === 'keep7' || periodChoice === 'keep30' ? (
              <QuietText style={typeScale.caption}>{t('clearData.period.keepHint')}</QuietText>
            ) : null}
          </View>
        ) : null}

        <ScopeRow
          label={t('clearData.calendar.label')}
          description={t('clearData.calendar.description')}
          checked={options.calendar}
          onToggle={(v) => toggle('calendar', v)}
        />
        <ScopeRow
          label={t('clearData.weatherCache.label')}
          description={t('clearData.weatherCache.description')}
          checked={options.weather}
          onToggle={(v) => toggle('weather', v)}
        />
        <ScopeRow
          label={t('clearData.appPreferences.label')}
          description={t('clearData.appPreferences.description')}
          checked={options.preferences}
          onToggle={(v) => toggle('preferences', v)}
        />
        <ScopeRow
          label={t('clearData.habitsCounters.label')}
          description={t('clearData.habitsCounters.description')}
          checked={options.definitions}
          danger
          onToggle={(v) => toggle('definitions', v)}
        />
      </View>

      {summary.length > 0 ? (
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.colors.errorContainer, borderRadius: deco.radius.md },
          ]}
        >
          <Text style={[typeScale.caption, { color: theme.colors.onErrorContainer }]}>
            {t('clearData.willRemoveTitle')}
          </Text>
          {summary.map((line) => (
            <Text
              key={line}
              style={[typeScale.secondary, { color: theme.colors.onErrorContainer }]}
            >
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
    </EditorSheet>
  );
}

function ScopeRow({
  label,
  description,
  checked,
  disabled,
  danger,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  danger?: boolean;
  onToggle: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      disabled={disabled}
      style={[styles.scopeRow, disabled ? styles.disabled : null]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
    >
      <View style={styles.scopeText}>
        <Text style={[typeScale.body, { color: danger ? theme.colors.error : theme.colors.onSurface }]}>
          {label}
        </Text>
        <QuietText style={typeScale.secondary}>{description}</QuietText>
      </View>
      <SheetCheck checked={checked} danger={danger} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exportBtn: {
    alignSelf: 'flex-start',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
  },
  scopeText: {
    flex: 1,
    minWidth: 0,
    gap: space.xxs,
  },
  disabled: {
    opacity: 0.5,
  },
  periodBlock: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  summary: {
    padding: space.md,
    gap: space.xxs,
  },
});
