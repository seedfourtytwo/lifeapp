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
import type { SoundAsset } from '../protocol';
import CounterEditorFields from './elementEditor/CounterEditorFields';
import FormSection from './elementEditor/FormSection';
import HabitEditorFields from './elementEditor/HabitEditorFields';
import type {
  ElementEditorSaveData,
  ElementEditorSession,
  HabitEditorFieldState,
} from './elementEditor/types';

export type {
  ElementEditorMode,
  ElementEditorSaveData,
  ElementEditorSession,
  HabitScheduleType,
} from './elementEditor/types';

type Props = {
  session: ElementEditorSession | null;
  saving: boolean;
  deleting?: boolean;
  soundOptions: SoundAsset[];
  onDismiss: () => void;
  onSave: (data: ElementEditorSaveData) => void;
  onDelete?: () => void;
};

function habitFieldStateFromSession(session: ElementEditorSession): HabitEditorFieldState {
  return {
    targetLabel: session.targetLabel,
    habitTrackingMode: session.habitTrackingMode,
    habitDailyGoalMinutes: session.habitDailyGoalMinutes,
    habitSoundId: session.habitSoundId,
    timeSlot: session.timeSlot,
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
  };
}

export default function ElementEditorDialog({
  session,
  saving,
  deleting = false,
  soundOptions,
  onDismiss,
  onSave,
  onDelete,
}: Props) {
  const theme = useTheme();
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
  const [habitFields, setHabitFields] = useState<HabitEditorFieldState>(() =>
    habitFieldStateFromSession({
      sessionId: '',
      mode: 'habit',
      editingId: null,
      name: '',
      increments: '',
      dailyTarget: '',
      targetLabel: '',
      habitTrackingMode: 'boolean',
      habitDailyGoalMinutes: '',
      habitSoundId: '',
      timeSlot: 'morning',
      useTimeRange: false,
      timeRangeStart: '',
      timeRangeEnd: '',
      visibleOnlyInTimeRange: false,
      scheduleType: 'daily',
      scheduleWeekdays: [1, 2, 3, 4, 5],
      scheduleInterval: '2',
      scheduleAnchorDate: '',
      useReminder: false,
      remindMinutesBefore: '15',
    }),
  );

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setHabitFields(habitFieldStateFromSession(session));
  }, [session, sessionId]);

  const handleSave = () => {
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
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { width: sheetWidth, maxHeight: sheetMaxHeight },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.header}>
              <Text variant="titleLarge" style={styles.headerTitle}>
                {title}
              </Text>
              <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Close" />
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
              ) : (
                <HabitEditorFields
                  state={habitFields}
                  soundOptions={soundOptions}
                  onChange={(patch) => setHabitFields((current) => ({ ...current, ...patch }))}
                />
              )}
            </ScrollView>

            <Divider />

            <View style={styles.footer}>
              {editingId && onDelete ? (
                <Button
                  textColor={theme.colors.error}
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
                <Button onPress={onDismiss} disabled={saving || deleting}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  loading={saving}
                  onPress={handleSave}
                  disabled={!name.trim() || saving || deleting}
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
    borderRadius: 16,
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
