import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { HabitTimeSlot, HabitTrackingMode, SoundAsset } from '../protocol';

export type ElementEditorMode = 'counter' | 'habit';

export type ElementEditorSession = {
  sessionId: string;
  mode: ElementEditorMode;
  editingId: string | null;
  name: string;
  increments: string;
  dailyTarget: string;
  targetLabel: string;
  habitTrackingMode: HabitTrackingMode;
  habitDailyGoalMinutes: string;
  habitSoundId: string;
  timeSlot: HabitTimeSlot;
  useTimeRange: boolean;
  timeRangeStart: string;
  timeRangeEnd: string;
  visibleOnlyInTimeRange: boolean;
};

export type ElementEditorSaveData =
  | {
      mode: 'counter';
      name: string;
      increments: string;
      dailyTarget: string;
    }
  | {
      mode: 'habit';
      name: string;
      targetLabel: string;
      habitTrackingMode: HabitTrackingMode;
      habitDailyGoalMinutes: string;
      habitSoundId: string;
      timeSlot: HabitTimeSlot;
      useTimeRange: boolean;
      timeRangeStart: string;
      timeRangeEnd: string;
      visibleOnlyInTimeRange: boolean;
    };

type Props = {
  session: ElementEditorSession | null;
  saving: boolean;
  soundOptions: SoundAsset[];
  onDismiss: () => void;
  onSave: (data: ElementEditorSaveData) => void;
};

export default function ElementEditorDialog({
  session,
  saving,
  soundOptions,
  onDismiss,
  onSave,
}: Props) {
  const visible = session !== null;
  const mode = session?.mode ?? 'counter';
  const editingId = session?.editingId ?? null;

  const [name, setName] = useState('');
  const [increments, setIncrements] = useState('5, 10');
  const [dailyTarget, setDailyTarget] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [habitTrackingMode, setHabitTrackingMode] = useState<HabitTrackingMode>('boolean');
  const [habitDailyGoalMinutes, setHabitDailyGoalMinutes] = useState('');
  const [habitSoundId, setHabitSoundId] = useState('');
  const [timeSlot, setTimeSlot] = useState<HabitTimeSlot>('morning');
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [timeRangeStart, setTimeRangeStart] = useState('');
  const [timeRangeEnd, setTimeRangeEnd] = useState('');
  const [visibleOnlyInTimeRange, setVisibleOnlyInTimeRange] = useState(false);

  const sessionId = session?.sessionId;

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setTargetLabel(session.targetLabel);
    setHabitTrackingMode(session.habitTrackingMode);
    setHabitDailyGoalMinutes(session.habitDailyGoalMinutes);
    setHabitSoundId(session.habitSoundId);
    setTimeSlot(session.timeSlot);
    setUseTimeRange(session.useTimeRange);
    setTimeRangeStart(session.timeRangeStart);
    setTimeRangeEnd(session.timeRangeEnd);
    setVisibleOnlyInTimeRange(session.visibleOnlyInTimeRange);
  }, [session, sessionId]);

  const handleSave = () => {
    if (mode === 'counter') {
      onSave({ mode: 'counter', name, increments, dailyTarget });
      return;
    }
    onSave({
      mode: 'habit',
      name,
      targetLabel,
      habitTrackingMode,
      habitDailyGoalMinutes,
      habitSoundId,
      timeSlot,
      useTimeRange,
      timeRangeStart,
      timeRangeEnd,
      visibleOnlyInTimeRange,
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} key={session?.sessionId}>
        <Dialog.Title>
          {mode === 'counter'
            ? (editingId ? 'Edit counter' : 'New counter')
            : (editingId ? 'Edit habit' : 'New habit')}
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <Dialog.Content style={styles.content}>
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCorrect={false}
            />
            {mode === 'counter' ? (
              <>
                <TextInput
                  label="Quick increments (comma-separated)"
                  value={increments}
                  onChangeText={setIncrements}
                  keyboardType="numbers-and-punctuation"
                  style={styles.input}
                />
                <TextInput
                  label="Daily target (optional)"
                  placeholder="e.g. 50"
                  value={dailyTarget}
                  onChangeText={setDailyTarget}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <Text variant="labelMedium" style={styles.slotLabel}>
                  Type
                </Text>
                <SegmentedButtons
                  value={habitTrackingMode}
                  onValueChange={(value) => {
                    if (value) setHabitTrackingMode(value as HabitTrackingMode);
                  }}
                  buttons={[
                    { value: 'boolean', label: 'Check off' },
                    { value: 'timer', label: 'Timer' },
                  ]}
                />
                {habitTrackingMode === 'timer' ? (
                  <>
                    <TextInput
                      label="Daily goal (minutes, optional)"
                      placeholder="e.g. 15"
                      value={habitDailyGoalMinutes}
                      onChangeText={setHabitDailyGoalMinutes}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    <Text variant="labelMedium" style={styles.slotLabel}>
                      Sound while running
                    </Text>
                    {soundOptions.length === 0 ? (
                      <Text variant="bodySmall" style={styles.soundHint}>
                        Add tracks in App settings → Sound tracks.
                      </Text>
                    ) : (
                      <View style={styles.soundList}>
                        <Button
                          mode={habitSoundId === '' ? 'contained-tonal' : 'outlined'}
                          onPress={() => setHabitSoundId('')}
                          style={styles.soundOption}
                          compact
                        >
                          None
                        </Button>
                        {soundOptions.map((sound) => (
                          <Button
                            key={sound.id}
                            mode={habitSoundId === sound.id ? 'contained-tonal' : 'outlined'}
                            onPress={() => setHabitSoundId(sound.id)}
                            style={styles.soundOption}
                            compact
                            icon="music-note"
                          >
                            {sound.label}
                          </Button>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <TextInput
                    label="Note (optional)"
                    placeholder="e.g. 1 cup, stretch"
                    value={targetLabel}
                    onChangeText={setTargetLabel}
                    style={styles.input}
                  />
                )}
                <Text variant="labelMedium" style={styles.slotLabel}>
                  Time of day
                </Text>
                <SegmentedButtons
                  value={timeSlot}
                  onValueChange={(value) => {
                    if (value) setTimeSlot(value as HabitTimeSlot);
                  }}
                  buttons={[
                    { value: 'morning', label: 'AM' },
                    { value: 'afternoon', label: 'Day' },
                    { value: 'evening', label: 'PM' },
                    { value: 'anytime', label: 'Any' },
                  ]}
                />
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">Daily time range</Text>
                  <Switch value={useTimeRange} onValueChange={setUseTimeRange} />
                </View>
                {useTimeRange ? (
                  <>
                    <TextInput
                      label="From"
                      placeholder="06:00"
                      value={timeRangeStart}
                      onChangeText={setTimeRangeStart}
                      keyboardType="numbers-and-punctuation"
                      style={styles.input}
                    />
                    <TextInput
                      label="To"
                      placeholder="09:00"
                      value={timeRangeEnd}
                      onChangeText={setTimeRangeEnd}
                      keyboardType="numbers-and-punctuation"
                      style={styles.input}
                    />
                    <View style={styles.switchRow}>
                      <View style={styles.switchLabel}>
                        <Text variant="bodyMedium">Only show during this time</Text>
                        <Text variant="bodySmall" style={styles.switchHint}>
                          Hidden on the Daily tab outside this window
                        </Text>
                      </View>
                      <Switch
                        value={visibleOnlyInTimeRange}
                        onValueChange={setVisibleOnlyInTimeRange}
                      />
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Dialog.Content>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button loading={saving} onPress={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 480,
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: 24,
  },
  input: { marginBottom: 8 },
  slotLabel: { marginBottom: 8, marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
  },
  switchHint: {
    marginTop: 2,
    opacity: 0.6,
  },
  soundHint: {
    opacity: 0.6,
    marginBottom: 8,
  },
  soundList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  soundOption: {
    marginBottom: 0,
  },
});
