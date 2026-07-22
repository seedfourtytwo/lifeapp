import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TrackerEditorDialog from '../components/TrackerEditorDialog';
import TrackerLibraryCard, {
  type TrackerLibraryBadge,
} from '../components/TrackerLibraryCard';
import TrackersCollapsibleSection from '../components/TrackersCollapsibleSection';
import {
  editorSessionFromCounter,
  editorSessionFromHabit,
  newEditorSession,
  type TrackerEditorSaveData,
  type TrackerEditorSession,
} from '../components/trackerEditor';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import {
  CounterConfigSchema,
  HabitConfigSchema,
  type ElementDefinition,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { counterMetaLines, habitMetaLines } from '../utils/trackerMetaLines';
import { getTrackerKindAccent } from '../utils/trackerKindAccent';
import { isElementArchived } from '../utils/dashboardElements';
import { parseTrackerEditorSave } from '../utils/parseTrackerEditorSave';

function runElementMutation(action: () => Promise<void>, errorTitle: string): void {
  void action().catch((error) => {
    Alert.alert(errorTitle, error instanceof Error ? error.message : 'Something went wrong');
  });
}

function confirmArchive(
  elementName: string,
  kindLabel: string,
  onConfirm: () => Promise<void>,
): void {
  Alert.alert(
    `Archive ${kindLabel}?`,
    `"${elementName}" will be hidden from Home. You can restore it from Archive later.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => runElementMutation(onConfirm, 'Could not archive'),
      },
    ],
  );
}

export default function TrackersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { themeMode } = useAppTheme();
  const counterAccent = getTrackerKindAccent(themeMode, 'counter').color;
  const habitAccent = getTrackerKindAccent(themeMode, 'habit').color;

  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const createCounter = useElementStore((s) => s.createCounter);
  const updateCounter = useElementStore((s) => s.updateCounter);
  const createHabit = useElementStore((s) => s.createHabit);
  const updateHabit = useElementStore((s) => s.updateHabit);
  const archiveElement = useElementStore((s) => s.archiveElement);
  const restoreElement = useElementStore((s) => s.restoreElement);
  const deleteElement = useElementStore((s) => s.deleteElement);

  const [editorSession, setEditorSession] = useState<TrackerEditorSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeCounters = useMemo(
    () => elements.filter((element) => element.kind === 'counter' && !isElementArchived(element)),
    [elements],
  );
  const activeHabits = useMemo(
    () => elements.filter((element) => element.kind === 'habit' && !isElementArchived(element)),
    [elements],
  );
  const archivedElements = useMemo(
    () =>
      elements
        .filter((element) => isElementArchived(element))
        .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [elements],
  );

  const confirmDelete = useCallback(
    (elementId: string, elementName: string, kindLabel: string) => {
      Alert.alert(
        `Delete ${kindLabel}?`,
        `"${elementName}" and all its history and day notes will be removed permanently.`,
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

  const renderElementCard = useCallback(
    (element: ElementDefinition, archived: boolean) => {
      const kindLabel = element.kind === 'counter' ? 'counter' : 'habit';
      const accentColor = element.kind === 'counter' ? counterAccent : habitAccent;
      const badges: TrackerLibraryBadge[] =
        element.kind === 'counter'
          ? [{ label: 'Counter', tone: archived ? 'muted' : 'accent' }]
          : (() => {
              const config = HabitConfigSchema.parse(element.config);
              return [
                {
                  label: config.trackingMode === 'timer' ? 'Timer' : 'Check off',
                  tone: archived ? 'muted' : 'accent',
                },
              ];
            })();

      const metaLines =
        element.kind === 'counter'
          ? counterMetaLines(CounterConfigSchema.parse(element.config))
          : habitMetaLines(HabitConfigSchema.parse(element.config));

      const openEditor = () => {
        if (element.kind === 'counter') {
          const config = CounterConfigSchema.parse(element.config);
          setEditorSession(editorSessionFromCounter(element.id, element.name, config));
          return;
        }
        const config = HabitConfigSchema.parse(element.config);
        setEditorSession(editorSessionFromHabit(element.id, element.name, config));
      };

      return (
        <TrackerLibraryCard
          key={element.id}
          kind={element.kind}
          accentColor={accentColor}
          name={element.name}
          badges={badges}
          metaLines={metaLines}
          archived={archived}
          onEdit={openEditor}
          onHistory={() => navigation.navigate('TrackerHistory', { elementId: element.id })}
          onDelete={() => confirmDelete(element.id, element.name, kindLabel)}
          onArchive={
            archived
              ? undefined
              : () => confirmArchive(element.name, kindLabel, () => archiveElement(element.id))
          }
          onRestore={
            archived
              ? () => runElementMutation(() => restoreElement(element.id), 'Could not restore')
              : undefined
          }
        />
      );
    },
    [archiveElement, confirmDelete, counterAccent, habitAccent, navigation, restoreElement],
  );

  const handleSave = async (data: TrackerEditorSaveData) => {
    if (saving) return;
    const editingId = editorSession?.editingId ?? null;
    setSaving(true);
    try {
      const parsed = parseTrackerEditorSave(data);
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
          Active habits and counters appear on Home. Archive items to hide them without losing
          history or day notes — restore anytime from Archive below.
        </Text>

        <TrackersCollapsibleSection
          title="Counters"
          subtitle="Daily quantities with optional targets — totals reset each day"
          icon="counter"
          accentColor={counterAccent}
          count={activeCounters.length}
          addLabel="New counter"
          defaultCollapsed
          onAdd={() => setEditorSession(newEditorSession({ mode: 'counter' }))}
          emptyMessage="No active counters. Add one to track water, steps, or anything countable."
        >
          {activeCounters.map((element) => renderElementCard(element, false))}
        </TrackersCollapsibleSection>

        <TrackersCollapsibleSection
          title="Habits"
          subtitle="Daily check-offs or timed sessions"
          icon="checkbox-marked-circle-outline"
          accentColor={habitAccent}
          count={activeHabits.length}
          addLabel="New habit"
          defaultCollapsed
          onAdd={() => setEditorSession(newEditorSession({ mode: 'habit' }))}
          emptyMessage="No active habits. Add one for meditation, reading, or any daily routine."
        >
          {activeHabits.map((element) => renderElementCard(element, false))}
        </TrackersCollapsibleSection>

        <TrackersCollapsibleSection
          title="Archive"
          subtitle="Hidden from Home — history kept until deleted"
          icon="archive-outline"
          accentColor="#64748B"
          count={archivedElements.length}
          showAddButton={false}
          defaultCollapsed={archivedElements.length === 0}
          emptyMessage="Nothing archived. Archive a counter or habit to pause it without deleting its history."
        >
          {archivedElements.map((element) => renderElementCard(element, true))}
        </TrackersCollapsibleSection>
      </ScrollView>

      <TrackerEditorDialog
        session={editorSession}
        saving={saving}
        deleting={deleting}
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
  container: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: {
    opacity: 0.75,
    marginBottom: 16,
    lineHeight: 22,
  },
});
