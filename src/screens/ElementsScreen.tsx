import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  FAB,
  Text,
} from 'react-native-paper';
import ElementEditorDialog from '../components/ElementEditorDialog';
import ElementLibraryCard from '../components/ElementLibraryCard';
import {
  editorSessionFromCounter,
  editorSessionFromHabit,
  newEditorSession,
  type ElementEditorSaveData,
  type ElementEditorSession,
} from '../components/elementEditor';
import {
  CounterConfigSchema,
  HABIT_TIME_SLOT_LABELS,
  HabitConfigSchema,
  formatHabitDescription,
  formatScheduleDescription,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useSoundLibraryStore } from '../store/soundLibraryStore';
import { parseElementEditorSave } from '../utils/parseElementEditorSave';

function counterMetaLines(config: ReturnType<typeof CounterConfigSchema.parse>): string[] {
  const buttons = config.quickIncrements.map((n) => `+${n}`).join(', ');
  const goal = config.dailyTarget ? ` · Goal: ${config.dailyTarget}/day` : '';
  return [`Buttons: ${buttons}${goal}`];
}

function habitMetaLines(
  config: ReturnType<typeof HabitConfigSchema.parse>,
  soundLabel?: string,
): string[] {
  const lines: string[] = [];
  const description = formatHabitDescription(config);
  if (description) lines.push(description);
  lines.push(formatScheduleDescription(config.schedule));
  if (config.trackingMode === 'timer' && config.dailyTargetSeconds) {
    lines.push(`Goal: ${Math.round(config.dailyTargetSeconds / 60)} min/day`);
  }
  if (config.remindMinutesBefore !== undefined && config.timeRange) {
    lines.push(
      `Reminder: ${config.remindMinutesBefore} min before ${config.timeRange.start}`,
    );
  }
  if (config.trackingMode === 'timer' && config.soundId) {
    lines.push(`Sound: ${soundLabel ?? 'Missing track'}`);
  }
  return lines;
}

export default function ElementsScreen() {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const load = useElementStore((s) => s.load);
  const createCounter = useElementStore((s) => s.createCounter);
  const updateCounter = useElementStore((s) => s.updateCounter);
  const createHabit = useElementStore((s) => s.createHabit);
  const updateHabit = useElementStore((s) => s.updateHabit);
  const deleteElement = useElementStore((s) => s.deleteElement);
  const pinToDashboard = useElementStore((s) => s.pinToDashboard);
  const unpinFromDashboard = useElementStore((s) => s.unpinFromDashboard);
  const sounds = useSoundLibraryStore((s) => s.sounds);
  const loadSounds = useSoundLibraryStore((s) => s.load);

  const [editorSession, setEditorSession] = useState<ElementEditorSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    void load();
    void loadSounds();
  }, [load, loadSounds]);

  const pinnedElementIds = useMemo(
    () => new Set(dashboard.map((d) => d.elementId)),
    [dashboard],
  );
  const counters = useMemo(
    () => elements.filter((e) => e.kind === 'counter'),
    [elements],
  );
  const habits = useMemo(
    () => elements.filter((e) => e.kind === 'habit'),
    [elements],
  );

  const getDashboardItemId = useCallback(
    (elementId: string) => dashboard.find((d) => d.elementId === elementId)?.id,
    [dashboard],
  );

  const handleSave = async (data: ElementEditorSaveData) => {
    const editingId = editorSession?.editingId ?? null;
    setSaving(true);
    try {
      const parsed = parseElementEditorSave(data);
      if (parsed.kind === 'counter') {
        if (editingId) {
          await updateCounter(editingId, parsed.input);
        } else {
          await createCounter(parsed.input);
        }
      } else if (editingId) {
        await updateHabit(editingId, parsed.input);
      } else {
        await createHabit(parsed.input);
      }
      setEditorSession(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      Alert.alert('Could not save', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = useCallback(
    (elementId: string, elementName: string, kindLabel: string) => {
      Alert.alert(
        `Delete ${kindLabel}?`,
        `"${elementName}" and all its history will be removed permanently.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setDeleting(true);
                try {
                  await deleteElement(elementId);
                  setEditorSession(null);
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to delete';
                  Alert.alert('Could not delete', message);
                } finally {
                  setDeleting(false);
                }
              })();
            },
          },
        ],
      );
    },
    [deleteElement],
  );

  const editingElement = editorSession?.editingId
    ? elements.find((element) => element.id === editorSession.editingId)
    : undefined;

  if (isLoading && elements.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="bodyMedium" style={styles.intro}>
          Create counters and habits here. Pin items to show them on Home.
        </Text>

        <Text variant="titleSmall" style={styles.sectionHeader}>
          Counters
        </Text>
        {counters.length === 0 ? (
          <Text variant="bodySmall" style={styles.sectionEmpty}>
            No counters yet. Tap + to add one.
          </Text>
        ) : null}
        {counters.map((element) => {
          const config = CounterConfigSchema.parse(element.config);
          const isPinned = pinnedElementIds.has(element.id);
          const dashboardItemId = getDashboardItemId(element.id);

          return (
            <ElementLibraryCard
              key={element.id}
              name={element.name}
              chips={<Chip compact>Counter</Chip>}
              metaLines={counterMetaLines(config)}
              isPinned={isPinned}
              deleteLabel="Delete"
              dashboardItemId={dashboardItemId}
              onEdit={() =>
                setEditorSession(editorSessionFromCounter(element.id, element.name, config))
              }
              onDelete={() => confirmDelete(element.id, element.name, 'counter')}
              onPin={() => void pinToDashboard(element.id)}
              onUnpin={() => dashboardItemId && void unpinFromDashboard(dashboardItemId)}
            />
          );
        })}

        <Text variant="titleSmall" style={styles.sectionHeader}>
          Habits
        </Text>
        {habits.length === 0 ? (
          <Text variant="bodySmall" style={styles.sectionEmpty}>
            No habits yet. Tap + to add one.
          </Text>
        ) : null}
        {habits.map((element) => {
          const config = HabitConfigSchema.parse(element.config);
          const isPinned = pinnedElementIds.has(element.id);
          const dashboardItemId = getDashboardItemId(element.id);
          const soundLabel = config.soundId
            ? sounds.find((s) => s.id === config.soundId)?.label
            : undefined;

          return (
            <ElementLibraryCard
              key={element.id}
              name={element.name}
              chips={
                <>
                  <Chip compact>{config.trackingMode === 'timer' ? 'Timer' : 'Check off'}</Chip>
                  <Chip compact>{HABIT_TIME_SLOT_LABELS[config.timeSlot]}</Chip>
                </>
              }
              metaLines={habitMetaLines(config, soundLabel)}
              isPinned={isPinned}
              deleteLabel="Delete"
              dashboardItemId={dashboardItemId}
              onEdit={() =>
                setEditorSession(editorSessionFromHabit(element.id, element.name, config))
              }
              onDelete={() => confirmDelete(element.id, element.name, 'habit')}
              onPin={() => void pinToDashboard(element.id)}
              onUnpin={() => dashboardItemId && void unpinFromDashboard(dashboardItemId)}
            />
          );
        })}
      </ScrollView>

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: 'counter',
            label: 'New counter',
            onPress: () => {
              setFabOpen(false);
              setEditorSession(newEditorSession({ mode: 'counter' }));
            },
          },
          {
            icon: 'checkbox-marked-circle-outline',
            label: 'New habit',
            onPress: () => {
              setFabOpen(false);
              setEditorSession(newEditorSession({ mode: 'habit' }));
            },
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        style={styles.fab}
      />

      <ElementEditorDialog
        session={editorSession}
        saving={saving}
        deleting={deleting}
        soundOptions={sounds}
        onDismiss={() => setEditorSession(null)}
        onSave={(data) => void handleSave(data)}
        onDelete={
          editingElement
            ? () =>
                confirmDelete(
                  editingElement.id,
                  editingElement.name,
                  editingElement.kind === 'counter' ? 'counter' : 'habit',
                )
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 96 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: {
    opacity: 0.7,
    marginBottom: 8,
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionEmpty: { marginBottom: 12, opacity: 0.5 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
