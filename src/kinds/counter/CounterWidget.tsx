import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Button,
  Divider,
  IconButton,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { type CounterConfig, formatCounterUnit } from '../../protocol';
import { getCounterProgressBarColors } from '../../utils/color';
import { NoteIconButton } from '../../notes/NoteIconButton';
import type { WidgetProps } from '../types';
import TrackerCard from '../TrackerCard';
import { trackerCardStyles as cardStyles } from '../trackerCardStyles';

export function CounterWidget({
  element,
  config,
  todayTotal,
  onLog,
  onSetDailyTotal,
  onOpenDetails,
  onDictateNote,
  onEditNote,
  hasTodayNote,
}: WidgetProps<CounterConfig>) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const { width } = useWindowDimensions();
  const { themeMode, decorations: deco, isCartoon } = useAppTheme();
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const sheetWidth = Math.min(width - 24, 400);

  const dailyTarget = config.dailyTarget;
  const hasTarget = dailyTarget !== undefined && dailyTarget > 0;
  const progress = hasTarget ? todayTotal / dailyTarget : 0;
  const isComplete = hasTarget && todayTotal >= dailyTarget;
  const progressBarColors = getCounterProgressBarColors(themeMode);

  const countText = hasTarget
    ? `${todayTotal} / ${dailyTarget} ${formatCounterUnit(dailyTarget, config.unit)}`
    : `${todayTotal} ${formatCounterUnit(todayTotal, config.unit)}`;

  const metaColor = isCartoon
    ? theme.colors.onSecondaryContainer
    : theme.colors.onSurfaceVariant;

  const closeEdit = () => {
    if (saving) return;
    setEditVisible(false);
  };

  const openEdit = () => {
    setEditValue(String(todayTotal));
    setEditVisible(true);
  };

  const saveEdit = async () => {
    const total = parseInt(editValue.trim(), 10);
    if (Number.isNaN(total) || total < 0) {
      Alert.alert(t('counterWidget.invalidTotalTitle'), t('counterWidget.invalidTotalBody'));
      return;
    }
    setSaving(true);
    try {
      await onSetDailyTotal?.(total);
      setEditVisible(false);
    } catch (error) {
      Alert.alert(
        t('counterWidget.couldNotUpdateTitle'),
        error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TrackerCard
        progress={
          hasTarget
            ? {
                value: progress,
                color: isComplete
                  ? progressBarColors.complete
                  : progressBarColors.active,
                trackColor: theme.colors.surfaceVariant,
                height: deco.progressHeight,
              }
            : null
        }
      >
        <View style={cardStyles.headerRow}>
          <Pressable
            onPress={onOpenDetails}
            disabled={!onOpenDetails}
            style={({ pressed }) => [
              cardStyles.titlePress,
              pressed && onOpenDetails && cardStyles.pressed,
            ]}
          >
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[cardStyles.name, { color: theme.colors.onSurface }]}
            >
              {element.name}
            </Text>
          </Pressable>
          <View style={cardStyles.metaCluster}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[cardStyles.metaText, { color: metaColor }]}
            >
              {countText}
            </Text>
            {onSetDailyTotal ? (
              <IconButton
                icon="pencil-outline"
                size={16}
                onPress={openEdit}
                accessibilityLabel={t('counterWidget.editTodaysTotalA11y')}
                style={cardStyles.iconButton}
                hitSlop={8}
              />
            ) : null}
            {onDictateNote ? (
              <NoteIconButton
                hasNote={Boolean(hasTodayNote)}
                onPress={onDictateNote}
                onLongPress={onEditNote}
                size={16}
              />
            ) : null}
          </View>
        </View>

        <View style={cardStyles.actionRow}>
          {config.quickIncrements.map((increment) => (
            <Button
              key={increment}
              mode="contained"
              onPress={() => onLog?.(increment, { source: 'quick_button', increment })}
              style={[cardStyles.primaryButton, { borderRadius: deco.buttonRadius }]}
              labelStyle={[cardStyles.primaryButtonLabel, styles.incLabel]}
              contentStyle={[cardStyles.primaryButtonContent, styles.incContent]}
              buttonColor={isCartoon ? theme.colors.primary : undefined}
            >
              +{increment}
            </Button>
          ))}
        </View>
      </TrackerCard>

      <Portal>
        <Modal
          visible={editVisible}
          onDismiss={closeEdit}
          contentContainerStyle={[styles.modalContainer, { width: sheetWidth }]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <View
              style={[
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
              <View style={styles.sheetHeader}>
                <Text
                  variant="titleLarge"
                  style={[styles.sheetTitle, { color: theme.colors.onSurface }]}
                >
                  {t('counterWidget.editTotalTitle')}
                </Text>
                <IconButton
                  icon="close"
                  onPress={closeEdit}
                  disabled={saving}
                  accessibilityLabel={tCommon('actions.close')}
                />
              </View>

              <View style={styles.sheetBody}>
                <Text
                  variant="bodySmall"
                  style={[styles.sheetHint, { color: theme.colors.onSurfaceVariant }]}
                >
                  {t('counterWidget.replacesTotalHint', { unit: config.unit })}
                </Text>
                <TextInput
                  label={t('counterWidget.totalLabel', { unit: config.unit })}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="number-pad"
                  mode="outlined"
                  autoFocus
                  selectTextOnFocus
                />
              </View>

              <Divider />

              <View style={styles.sheetFooter}>
                <Button onPress={closeEdit} disabled={saving}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void saveEdit()}
                  loading={saving}
                  disabled={saving}
                  buttonColor={isCartoon ? theme.colors.primary : undefined}
                  style={{ borderRadius: deco.buttonRadius }}
                >
                  {tCommon('actions.save')}
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  incContent: {
    paddingHorizontal: 4,
  },
  incLabel: {
    fontSize: 14,
  },
  modalContainer: {
    alignSelf: 'center',
    marginHorizontal: 12,
  },
  keyboardAvoid: {
    flexGrow: 0,
  },
  sheet: {
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 4,
    paddingTop: 4,
  },
  sheetTitle: {
    flex: 1,
    paddingRight: 8,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  sheetHint: {
    lineHeight: 18,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
});
