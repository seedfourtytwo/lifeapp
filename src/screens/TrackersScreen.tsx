import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import TrackerEditorDialog from '../components/TrackerEditorDialog';
import TrackerLibraryCard from '../components/TrackerLibraryCard';
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

function runElementMutation(
  action: () => Promise<void>,
  errorTitle: string,
  tCommon: TFunction,
): void {
  void action().catch((error) => {
    Alert.alert(
      errorTitle,
      error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
    );
  });
}

function confirmArchive(
  elementName: string,
  kindLabel: string,
  onConfirm: () => Promise<void>,
  tTrackers: TFunction,
  tCommon: TFunction,
): void {
  Alert.alert(
    tTrackers('confirm.archiveTitle', { kind: kindLabel }),
    tTrackers('confirm.archiveBody', { name: elementName }),
    [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      {
        text: tCommon('actions.archive'),
        onPress: () =>
          runElementMutation(onConfirm, tCommon('alerts.couldNotArchive'), tCommon),
      },
    ],
  );
}

export default function TrackersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
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
        t('confirm.deleteTitle', { kind: kindLabel }),
        t('confirm.deleteBody', { name: elementName }),
        [
          { text: tCommon('actions.cancel'), style: 'cancel' },
          {
            text: tCommon('actions.delete'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setDeleting(true);
                try {
                  await deleteElement(elementId);
                  setEditorSession(null);
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : tCommon('errors.failedToDelete');
                  Alert.alert(tCommon('alerts.couldNotDelete'), message);
                } finally {
                  setDeleting(false);
                }
              })();
            },
          },
        ],
      );
    },
    [deleteElement, t, tCommon],
  );

  const renderElementCard = useCallback(
    (element: ElementDefinition, archived: boolean) => {
      const kindLabel = t(element.kind === 'counter' ? 'kindLabel.counter' : 'kindLabel.habit');
      const accentColor = element.kind === 'counter' ? counterAccent : habitAccent;

      if (element.kind === 'counter') {
        const parsed = CounterConfigSchema.safeParse(element.config);
        if (!parsed.success) return null;
        const config = parsed.data;
        return (
          <TrackerLibraryCard
            key={element.id}
            accentColor={accentColor}
            name={element.name}
            icon={config.icon}
            description={counterMetaLines(config)[0]}
            archived={archived}
            onEdit={() =>
              setEditorSession(editorSessionFromCounter(element.id, element.name, config))
            }
            onHistory={() => navigation.navigate('TrackerHistory', { elementId: element.id })}
            onDelete={() => confirmDelete(element.id, element.name, kindLabel)}
            onArchive={
              archived
                ? undefined
                : () =>
                    confirmArchive(
                      element.name,
                      kindLabel,
                      () => archiveElement(element.id),
                      t,
                      tCommon,
                    )
            }
            onRestore={
              archived
                ? () =>
                    runElementMutation(
                      () => restoreElement(element.id),
                      tCommon('alerts.couldNotRestore'),
                      tCommon,
                    )
                : undefined
            }
          />
        );
      }

      const parsed = HabitConfigSchema.safeParse(element.config);
      if (!parsed.success) return null;
      const config = parsed.data;
      return (
        <TrackerLibraryCard
          key={element.id}
          accentColor={accentColor}
          name={element.name}
          icon={config.icon}
          description={[
            config.trackingMode === 'timer' ? t('card.timerBadge') : t('card.checkOffBadge'),
            habitMetaLines(config)[0],
          ]
            .filter(Boolean)
            .join(' · ')}
          archived={archived}
          onEdit={() => setEditorSession(editorSessionFromHabit(element.id, element.name, config))}
          onHistory={() => navigation.navigate('TrackerHistory', { elementId: element.id })}
          onDelete={() => confirmDelete(element.id, element.name, kindLabel)}
          onArchive={
            archived
              ? undefined
              : () =>
                  confirmArchive(
                    element.name,
                    kindLabel,
                    () => archiveElement(element.id),
                    t,
                    tCommon,
                  )
          }
          onRestore={
            archived
              ? () =>
                  runElementMutation(
                    () => restoreElement(element.id),
                    tCommon('alerts.couldNotRestore'),
                    tCommon,
                  )
              : undefined
          }
        />
      );
    },
    [
      archiveElement,
      confirmDelete,
      counterAccent,
      habitAccent,
      navigation,
      restoreElement,
      t,
      tCommon,
    ],
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
      const message = error instanceof Error ? error.message : tCommon('errors.failedToSave');
      Alert.alert(tCommon('alerts.couldNotSave'), message);
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
        <TrackersCollapsibleSection
          title={t('screen.countersTitle')}
          icon="counter"
          accentColor={counterAccent}
          count={activeCounters.length}
          addLabel={t('screen.countersAddLabel')}
          onAdd={() => setEditorSession(newEditorSession({ mode: 'counter' }))}
          emptyMessage={t('screen.countersEmpty')}
        >
          {activeCounters.map((element) => renderElementCard(element, false))}
        </TrackersCollapsibleSection>

        <TrackersCollapsibleSection
          title={t('screen.habitsTitle')}
          icon="checkbox-marked-circle-outline"
          accentColor={habitAccent}
          count={activeHabits.length}
          addLabel={t('screen.habitsAddLabel')}
          onAdd={() => setEditorSession(newEditorSession({ mode: 'habit' }))}
          emptyMessage={t('screen.habitsEmpty')}
        >
          {activeHabits.map((element) => renderElementCard(element, false))}
        </TrackersCollapsibleSection>

        <TrackersCollapsibleSection
          title={t('screen.archiveTitle')}
          icon="archive-outline"
          accentColor="#64748B"
          count={archivedElements.length}
          showAddButton={false}
          defaultCollapsed={archivedElements.length === 0}
          emptyMessage={t('screen.archiveEmpty')}
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
                  t(editingElement.kind === 'counter' ? 'kindLabel.counter' : 'kindLabel.habit'),
                )
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
