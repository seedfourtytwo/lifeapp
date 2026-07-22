import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { stopHabitSound } from '../audio/habitTimerSound';
import { useAppTheme } from '../hooks/useAppTheme';
import CounterEditorFields from './trackerEditor/CounterEditorFields';
import { newEditorSession } from './trackerEditor/trackerEditorSession';
import FormSection from './trackerEditor/FormSection';
import HabitEditorFields from './trackerEditor/HabitEditorFields';
import type {
  TrackerEditorSaveData,
  TrackerEditorSession,
  HabitEditorFieldState,
} from './trackerEditor/types';

type Props = {
  session: TrackerEditorSession | null;
  saving: boolean;
  deleting?: boolean;
  onDismiss: () => void;
  onSave: (data: TrackerEditorSaveData) => void;
  onDelete?: () => void;
};

function habitFieldStateFromSession(session: TrackerEditorSession): HabitEditorFieldState {
  return {
    targetLabel: session.targetLabel,
    habitTrackingMode: session.habitTrackingMode,
    habitDailyGoalMinutes: session.habitDailyGoalMinutes,
    habitSoundTrackId: session.habitSoundTrackId,
    habitSoundPlaybackMode: session.habitSoundPlaybackMode,
    useTimeRange: session.useTimeRange,
    timeRangeStart: session.timeRangeStart,
    timeRangeEnd: session.timeRangeEnd,
    visibleOnlyInTimeRange: session.visibleOnlyInTimeRange,
    scheduleType: session.scheduleType,
    scheduleWeekdays: session.scheduleWeekdays,
    scheduleInterval: session.scheduleInterval,
    scheduleAnchorDate: session.scheduleAnchorDate,
    useReminder: session.useReminder,
    remindMinutesBefore: session.remindMinutesBefore,
    showStreakOnCard: session.showStreakOnCard,
  };
}

const emptyHabitFields = (): HabitEditorFieldState =>
  habitFieldStateFromSession(newEditorSession({ mode: 'habit' }));

export default function TrackerEditorDialog({
  session,
  saving,
  deleting = false,
  onDismiss,
  onSave,
  onDelete,
}: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const sheetWidth = Math.min(width - 24, 480);
  const sheetMaxHeight = Math.min(height * 0.9, 720);

  const visible = session !== null;
  const mode = session?.mode ?? 'counter';
  const editingId = session?.editingId ?? null;
  const sessionId = session?.sessionId;

  const [name, setName] = useState('');
  const [increments, setIncrements] = useState('5, 10');
  const [dailyTarget, setDailyTarget] = useState('');
  const [habitFields, setHabitFields] = useState<HabitEditorFieldState>(emptyHabitFields);

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setHabitFields(habitFieldStateFromSession(session));
  }, [session, sessionId]);

  const closeEditor = () => {
    void stopHabitSound();
    onDismiss();
  };

  const handleSave = () => {
    void stopHabitSound();
    if (mode === 'counter') {
      onSave({ mode: 'counter', name, increments, dailyTarget });
      return;
    }
    onSave({
      mode: 'habit',
      name,
      ...habitFields,
    });
  };

  const title = useMemo(() => {
    if (mode === 'counter') {
      return editingId ? 'Edit counter' : 'New counter';
    }
    return editingId ? 'Edit habit' : 'New habit';
  }, [editingId, mode]);

  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={!saving && !deleting}
        onDismiss={saving || deleting ? undefined : closeEditor}
        contentContainerStyle={[
          styles.modalContainer,
          { width: sheetWidth, maxHeight: sheetMaxHeight },
        ]}
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
            <View style={styles.header}>
              <Text
                variant="titleLarge"
                style={[styles.headerTitle, isCartoon && { color: theme.colors.onSurface }]}
              >
                {title}
              </Text>
              <IconButton icon="close" onPress={closeEditor} accessibilityLabel="Close" />
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormSection title="Name">
                <TextInput
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  mode="outlined"
                  autoCorrect={false}
                />
              </FormSection>

              {mode === 'counter' ? (
                <CounterEditorFields
                  increments={increments}
                  dailyTarget={dailyTarget}
                  onIncrementsChange={setIncrements}
                  onDailyTargetChange={setDailyTarget}
                />
              ) : session && mode === 'habit' ? (
                <HabitEditorFields
                  state={habitFields}
                  onChange={(patch) => setHabitFields((current) => ({ ...current, ...patch }))}
                />
              ) : null}
            </ScrollView>

            <Divider />

            <View style={styles.footer}>
              {editingId && onDelete ? (
                <Button
                  mode="outlined"
                  icon="delete-outline"
                  textColor={theme.colors.onErrorContainer}
                  style={{
                    borderColor: theme.colors.error,
                    backgroundColor: theme.colors.errorContainer,
                    borderRadius: deco.buttonRadius,
                  }}
                  onPress={onDelete}
                  loading={deleting}
                  disabled={saving || deleting}
                >
                  Delete
                </Button>
              ) : (
                <View />
              )}
              <View style={styles.footerActions}>
                <Button onPress={closeEditor} disabled={saving || deleting}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  loading={saving}
                  onPress={handleSave}
                  disabled={!name.trim() || saving || deleting}
                  buttonColor={isCartoon ? theme.colors.primary : undefined}
                  style={{ borderRadius: deco.buttonRadius }}
                >
                  Save
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    alignSelf: 'center',
    marginHorizontal: 12,
  },
  keyboardAvoid: {
    flexGrow: 0,
  },
  sheet: {
    overflow: 'hidden',
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 4,
    paddingTop: 4,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
