import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Text,
  useTheme,
} from 'react-native-paper';
import ElementEditorDialog, {
  type ElementEditorSaveData,
  type ElementEditorSession,
} from '../components/ElementEditorDialog';
import {
  CounterConfigSchema,
  HABIT_TIME_SLOT_LABELS,
  HabitConfigSchema,
  formatHabitDescription,
  type CounterConfig,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useSoundLibraryStore } from '../store/soundLibraryStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { newId } from '../utils/id';
import { parseTimeHHmm } from '../utils/time';

function newEditorSession(
  overrides: Partial<ElementEditorSession> & Pick<ElementEditorSession, 'mode'>,
): ElementEditorSession {
  return {
    sessionId: newId(),
    editingId: null,
    name: '',
    increments: '5, 10',
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
    ...overrides,
  };
}

export default function ElementsScreen() {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const load = useElementStore((s) => s.load);
  const createCounter = useElementStore((s) => s.createCounter);
  const updateCounter = useElementStore((s) => s.updateCounter);
  const createHabit = useElementStore((s) => s.createHabit);
  const updateHabit = useElementStore((s) => s.updateHabit);
  const pinToDashboard = useElementStore((s) => s.pinToDashboard);
  const unpinFromDashboard = useElementStore((s) => s.unpinFromDashboard);
  const sounds = useSoundLibraryStore((s) => s.sounds);
  const loadSounds = useSoundLibraryStore((s) => s.load);

  const [editorSession, setEditorSession] = useState<ElementEditorSession | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
    void loadSounds();
  }, [load, loadSounds]);

  const pinnedElementIds = new Set(dashboard.map((d) => d.elementId));
  const counters = elements.filter((e) => e.kind === 'counter');
  const habits = elements.filter((e) => e.kind === 'habit');

  const openCreateCounter = () => {
    setEditorSession(newEditorSession({ mode: 'counter' }));
  };

  const openCreateHabit = () => {
    setEditorSession(newEditorSession({ mode: 'habit' }));
  };

  const openEditCounter = (id: string, currentName: string, config: CounterConfig) => {
    setEditorSession(newEditorSession({
      mode: 'counter',
      editingId: id,
      name: currentName,
      increments: config.quickIncrements.join(', '),
      dailyTarget: config.dailyTarget ? String(config.dailyTarget) : '',
    }));
  };

  const openEditHabit = (id: string, currentName: string, config: HabitConfig) => {
    setEditorSession(newEditorSession({
      mode: 'habit',
      editingId: id,
      name: currentName,
      targetLabel: config.targetLabel ?? '',
      habitTrackingMode: config.trackingMode,
      habitDailyGoalMinutes: config.dailyTargetSeconds
        ? String(Math.round(config.dailyTargetSeconds / 60))
        : '',
      habitSoundId: config.soundId ?? '',
      timeSlot: config.timeSlot,
      useTimeRange: Boolean(config.timeRange),
      timeRangeStart: config.timeRange?.start ?? '',
      timeRangeEnd: config.timeRange?.end ?? '',
      visibleOnlyInTimeRange: config.visibleOnlyInTimeRange ?? false,
    }));
  };

  const parseIncrements = (raw: string): number[] => {
    const values = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (values.length === 0) {
      throw new Error('Enter at least one positive number (e.g. 5, 10)');
    }
    return values;
  };

  const parseDailyTarget = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const value = parseInt(trimmed, 10);
    if (Number.isNaN(value) || value <= 0) {
      throw new Error('Daily target must be a positive whole number');
    }
    return value;
  };

  const parseDailyGoalMinutes = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const minutes = parseInt(trimmed, 10);
    if (Number.isNaN(minutes) || minutes <= 0) {
      throw new Error('Daily goal must be a positive number of minutes');
    }
    return minutes * 60;
  };

  const handleSave = async (data: ElementEditorSaveData) => {
    const editingId = editorSession?.editingId ?? null;
    setSaving(true);
    try {
      if (data.mode === 'counter') {
        const quickIncrements = parseIncrements(data.increments);
        const dailyTarget = parseDailyTarget(data.dailyTarget);
        const counterInput = {
          name: data.name,
          quickIncrements,
          dailyTarget,
        };
        if (editingId) {
          await updateCounter(editingId, counterInput);
        } else {
          await createCounter(counterInput);
        }
      } else {
        let timeRange: { start: string; end: string } | undefined;
        if (data.useTimeRange) {
          const start = parseTimeHHmm(data.timeRangeStart);
          const end = parseTimeHHmm(data.timeRangeEnd);
          if (!start || !end) {
            throw new Error('Enter valid times in HH:mm format, e.g. 06:00');
          }
          timeRange = { start, end };
        }
        if (data.visibleOnlyInTimeRange && !timeRange) {
          throw new Error('Set a time range before limiting visibility');
        }

        const habitInput = {
          name: data.name,
          trackingMode: data.habitTrackingMode,
          timeSlot: data.timeSlot,
          targetLabel: data.habitTrackingMode === 'boolean' ? data.targetLabel || undefined : undefined,
          dailyTargetSeconds:
            data.habitTrackingMode === 'timer'
              ? parseDailyGoalMinutes(data.habitDailyGoalMinutes)
              : undefined,
          soundId:
            data.habitTrackingMode === 'timer' && data.habitSoundId
              ? data.habitSoundId
              : undefined,
          timeRange,
          visibleOnlyInTimeRange: data.visibleOnlyInTimeRange,
        };

        if (editingId) {
          await updateHabit(editingId, habitInput);
        } else {
          await createHabit(habitInput);
        }
      }
      setEditorSession(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      Alert.alert('Could not save', message);
    } finally {
      setSaving(false);
    }
  };

  const getDashboardItemId = useCallback(
    (elementId: string) => dashboard.find((d) => d.elementId === elementId)?.id,
    [dashboard],
  );

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
        <Text variant="titleSmall" style={styles.sectionHeader}>
          Counters
        </Text>
        {counters.length === 0 ? (
          <Text variant="bodySmall" style={styles.sectionEmpty}>No counters yet.</Text>
        ) : null}
        {counters.map((element) => {
          const config = CounterConfigSchema.parse(element.config);
          const isPinned = pinnedElementIds.has(element.id);
          const dashboardItemId = getDashboardItemId(element.id);

          return (
            <Card
              key={element.id}
              style={[
                styles.card,
                isCartoon && {
                  borderWidth: deco.cardBorderWidth,
                  borderColor: theme.colors.outline,
                  borderRadius: deco.radius.md,
                },
              ]}
            >
              <Card.Content>
                <Text variant="titleMedium">{element.name}</Text>
                <View style={styles.chips}>
                  <Chip compact>{element.kind}</Chip>
                  {isPinned ? <Chip compact icon="pin">Pinned</Chip> : null}
                </View>
                <Text variant="bodySmall" style={styles.meta}>
                  Buttons: {config.quickIncrements.map((n) => `+${n}`).join(', ')}
                  {config.dailyTarget ? ` · Goal: ${config.dailyTarget}/day` : ''}
                </Text>
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => openEditCounter(element.id, element.name, config)}>
                  Edit
                </Button>
                {isPinned && dashboardItemId ? (
                  <Button onPress={() => void unpinFromDashboard(dashboardItemId)}>Unpin</Button>
                ) : (
                  <Button onPress={() => void pinToDashboard(element.id)}>Pin to top</Button>
                )}
              </Card.Actions>
            </Card>
          );
        })}

        <Text variant="titleSmall" style={styles.sectionHeader}>
          Habits
        </Text>
        {habits.length === 0 ? (
          <Text variant="bodySmall" style={styles.sectionEmpty}>No habits yet.</Text>
        ) : null}
        {habits.map((element) => {
          const config = HabitConfigSchema.parse(element.config);
          return (
            <Card
              key={element.id}
              style={[
                styles.card,
                isCartoon && {
                  borderWidth: deco.cardBorderWidth,
                  borderColor: theme.colors.outline,
                  borderRadius: deco.radius.md,
                },
              ]}
            >
              <Card.Content>
                <Text variant="titleMedium">{element.name}</Text>
                <View style={styles.chips}>
                  <Chip compact>{config.trackingMode === 'timer' ? 'Timer' : 'Check off'}</Chip>
                  <Chip compact>{HABIT_TIME_SLOT_LABELS[config.timeSlot]}</Chip>
                </View>
                {formatHabitDescription(config) ? (
                  <Text variant="bodySmall" style={styles.meta}>
                    {formatHabitDescription(config)}
                  </Text>
                ) : null}
                {config.trackingMode === 'timer' && config.dailyTargetSeconds ? (
                  <Text variant="bodySmall" style={styles.meta}>
                    Goal: {Math.round(config.dailyTargetSeconds / 60)} min/day
                  </Text>
                ) : null}
                {config.trackingMode === 'timer' && config.soundId ? (
                  <Text variant="bodySmall" style={styles.meta}>
                    Sound: {sounds.find((s) => s.id === config.soundId)?.label ?? 'Missing track'}
                  </Text>
                ) : null}
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => openEditHabit(element.id, element.name, config)}>
                  Edit
                </Button>
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>

      <View style={styles.fabRow}>
        <Button mode="contained" onPress={openCreateCounter} style={styles.fab}>
          New counter
        </Button>
        <Button mode="contained" onPress={openCreateHabit} style={styles.fab}>
          New habit
        </Button>
      </View>

      <ElementEditorDialog
        session={editorSession}
        saving={saving}
        soundOptions={sounds}
        onDismiss={() => setEditorSession(null)}
        onSave={(data) => void handleSave(data)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionEmpty: { marginBottom: 12, opacity: 0.5 },
  card: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  meta: { marginTop: 8, opacity: 0.6 },
  fabRow: {
    flexDirection: 'row',
    gap: 8,
    margin: 16,
  },
  fab: { flex: 1 },
});
