import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import TrackerEditorDialog from '../components/TrackerEditorDialog';
import { UndoSnackbar } from '../components/UndoSnackbar';
import TrackerLibraryCard from '../components/TrackerLibraryCard';
import TrackersCollapsibleSection from '../components/TrackersCollapsibleSection';
import {
  editorSessionFromCounter,
  editorSessionFromHabit,
  newEditorSession,
  type TrackerEditorSession,
} from '../components/trackerEditor';
import type { RootStackParamList } from '../navigation/types';
import { space } from '../theme/spacing';
import {
  CounterConfigSchema,
  HabitConfigSchema,
  type ElementDefinition,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { counterMetaLines, habitMetaLines } from '../utils/trackerMetaLines';
import { isElementArchived } from '../utils/dashboardElements';
import type { TrackerEditorSaved } from '../utils/parseTrackerEditorSave';
import { confirm, notify } from '../components/sheet/confirm';

function runElementMutation(
  action: () => Promise<void>,
  errorTitle: string,
  tCommon: TFunction,
): void {
  void action().catch((error) => {
    void notify({
      title: errorTitle,
      message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
    });
  });
}

export default function TrackersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');

  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const createCounter = useElementStore((s) => s.createCounter);
  const updateCounter = useElementStore((s) => s.updateCounter);
  const createHabit = useElementStore((s) => s.createHabit);
  const updateHabit = useElementStore((s) => s.updateHabit);
  const archiveElement = useElementStore((s) => s.archiveElement);
  const restoreElement = useElementStore((s) => s.restoreElement);
  /** The tracker just archived, while its Undo is on offer. */
  const [archivedUndo, setArchivedUndo] = useState<{ id: string; name: string } | null>(null);

  /** Archive at once and offer Undo, rather than asking first. */
  const archiveWithUndo = useCallback(
    (element: ElementDefinition) =>
      runElementMutation(
        async () => {
          await archiveElement(element.id);
          setArchivedUndo({ id: element.id, name: element.name });
        },
        tCommon('alerts.couldNotArchive'),
        tCommon,
      ),
    [archiveElement, tCommon],
  );

  const undoArchive = () => {
    const pending = archivedUndo;
    setArchivedUndo(null);
    if (!pending) return;
    runElementMutation(
      () => restoreElement(pending.id),
      tCommon('alerts.couldNotRestore'),
      tCommon,
    );
  };
  const deleteElement = useElementStore((s) => s.deleteElement);

  const [editorSession, setEditorSession] = useState<TrackerEditorSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * Opened from Home's + to add one tracker: show the editor at once, and go
   * back to Home when it closes rather than leaving the user in the library.
   */
  const route = useRoute<RouteProp<RootStackParamList, 'Trackers'>>();
  const addFromHome = route.params?.add;
  const returnAfterEditor = useRef(false);
  useEffect(() => {
    if (!addFromHome) return;
    returnAfterEditor.current = true;
    // `true` is "new, kind not chosen yet": the sheet opens on a habit and offers the switch.
    setEditorSession(newEditorSession({ mode: addFromHome === true ? 'habit' : addFromHome }));
    navigation.setParams({ add: undefined });
  }, [addFromHome, navigation]);

  const closeEditor = () => {
    setEditorSession(null);
    if (!returnAfterEditor.current) return;
    returnAfterEditor.current = false;
    if (navigation.canGoBack()) navigation.goBack();
  };

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
      void (async () => {
        const confirmed = await confirm({
          title: t('confirm.deleteTitle', { kind: kindLabel }),
          message: t('confirm.deleteBody', { name: elementName }),
          confirmLabel: tCommon('actions.delete'),
          destructive: true,
        });
        if (!confirmed) return;
        setDeleting(true);
        try {
          await deleteElement(elementId);
          setEditorSession(null);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : tCommon('errors.failedToDelete');
          void notify({ title: tCommon('alerts.couldNotDelete'), message });
        } finally {
          setDeleting(false);
        }
      })();
    },
    [deleteElement, t, tCommon],
  );

  const renderElementCard = useCallback(
    (element: ElementDefinition, archived: boolean) => {
      const kindLabel = t(element.kind === 'counter' ? 'kindLabel.counter' : 'kindLabel.habit');

      if (element.kind === 'counter') {
        const parsed = CounterConfigSchema.safeParse(element.config);
        if (!parsed.success) return null;
        const config = parsed.data;
        return (
          <TrackerLibraryCard
            key={element.id}
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
                : () => archiveWithUndo(element)
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
              : () => archiveWithUndo(element)
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
      archiveWithUndo,
      confirmDelete,
      navigation,
      restoreElement,
      t,
      tCommon,
    ],
  );

  const handleSave = async (parsed: TrackerEditorSaved) => {
    if (saving) return;
    const editingId = editorSession?.editingId ?? null;
    setSaving(true);
    try {
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
      closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.failedToSave');
      void notify({ title: tCommon('alerts.couldNotSave'), message });
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
        onDismiss={closeEditor}
        onSave={(saved) => void handleSave(saved)}
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
      <UndoSnackbar
        message={archivedUndo ? t('undo.archived', { name: archivedUndo.name }) : null}
        onUndo={undoArchive}
        onDismiss={() => setArchivedUndo(null)}
        aboveDock={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: space.lg, paddingBottom: space.xl + space.sm, gap: space.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
