import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Checkbox,
  Divider,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_CLEAR_OPTIONS,
  clearOptionsAreEmpty,
  describeClearPlan,
  type ActivityClearPeriod,
  type ClearAppDataOptions,
} from '../db/clearDataPlan';
import { useAppTheme } from '../hooks/useAppTheme';

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
  const { decorations: deco, isCartoon } = useAppTheme();
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
    <Portal>
      <Modal
        visible={visible}
        onDismiss={busy ? undefined : onDismiss}
        contentContainerStyle={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: deco.radius.lg,
            ...(isCartoon && {
              borderWidth: deco.cardBorderWidth,
              borderColor: theme.colors.outline,
            }),
          },
        ]}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text
            variant="titleMedium"
            style={[styles.title, isCartoon && { color: theme.colors.onSurface }]}
          >
            {t('clearData.title')}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
          >
            {t('clearData.subtitle')}
          </Text>

          {onExportFirst ? (
            <Button
              mode="outlined"
              icon="export"
              onPress={onExportFirst}
              disabled={busy}
              style={[styles.exportBtn, { borderRadius: deco.buttonRadius }]}
            >
              {t('clearData.exportFirstButton')}
            </Button>
          ) : null}

          <ScopeRow
            label={t('clearData.activityHistory.label')}
            description={t('clearData.activityHistory.description')}
            checked={options.activityHistory || options.definitions}
            disabled={options.definitions}
            onToggle={(v) => toggle('activityHistory', v)}
          />

          {activityEnabled ? (
            <View style={styles.periodBlock}>
              <Text variant="labelLarge" style={{ marginBottom: 8 }}>
                {t('clearData.period.label')}
              </Text>
              <View style={styles.chipRow}>
                {periodOptions.map((option) => {
                  const selected = periodChoice === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setPeriod(option.id)}
                      style={[
                        styles.chip,
                        {
                          borderWidth: isCartoon ? deco.borderWidth : 1,
                          borderRadius: deco.buttonRadius,
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                          backgroundColor: selected
                            ? theme.colors.primaryContainer
                            : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        variant="labelMedium"
                        style={{
                          color: selected
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurface,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {periodChoice === 'before' ? (
                <TextInput
                  label={t('clearData.period.beforeDateLabel')}
                  value={beforeDate}
                  onChangeText={setBeforeDate}
                  mode="outlined"
                  dense
                  placeholder={t('clearData.period.beforeDatePlaceholder')}
                  style={{ marginTop: 8 }}
                  error={beforeInvalid}
                />
              ) : null}
              {periodChoice === 'keep7' || periodChoice === 'keep30' ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}
                >
                  {t('clearData.period.keepHint')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Divider style={styles.divider} />

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

          {summary.length > 0 ? (
            <View
              style={[
                styles.summary,
                {
                  backgroundColor: theme.colors.errorContainer,
                  borderRadius: deco.radius.sm,
                  ...(isCartoon && {
                    borderWidth: deco.borderWidth,
                    borderColor: theme.colors.error,
                  }),
                },
              ]}
            >
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onErrorContainer, marginBottom: 4 }}
              >
                {t('clearData.willRemoveTitle')}
              </Text>
              {summary.map((line) => (
                <Text
                  key={line}
                  variant="bodySmall"
                  style={{ color: theme.colors.onErrorContainer }}
                >
                  • {line}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss} disabled={busy}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              style={{ borderRadius: deco.buttonRadius }}
              onPress={handleConfirm}
              loading={busy}
              disabled={busy || nothingSelected || beforeInvalid}
            >
              {t('clearData.confirmButton')}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
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
      onPress={() => !disabled && onToggle(!checked)}
      style={[styles.scopeRow, disabled && { opacity: 0.55 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
    >
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyLarge"
          style={danger ? { color: theme.colors.error, fontWeight: '600' } : undefined}
        >
          {label}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {description}
        </Text>
      </View>
      <Checkbox
        status={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onPress={() => !disabled && onToggle(!checked)}
        color={danger ? theme.colors.error : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: '88%',
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  exportBtn: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  periodBlock: {
    paddingLeft: 4,
    paddingBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divider: {
    marginVertical: 4,
  },
  summary: {
    padding: 12,
    marginTop: 8,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
});
