import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
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
  editorSessionFromCommitment,
  editorSessionFromCounter,
  editorSessionFromHabit,
  newEditorSession,
  type TrackerEditorSaveData,
  type TrackerEditorSession,
} from '../components/trackerEditor';
import type { RootStackParamList } from '../navigation/types';
import type { ElementDefinition } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { counterMetaLines, habitMetaLines } from '../utils/trackerMetaLines';
import { getActiveCommitment, isElementArchived } from '../utils/dashboardElements';
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
  const createCommitment = useElementStore((s) => s.createCommitment);
  const updateCommitment = useElementStore((s) => s.updateCommitment);
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
    setEditorSession(newEditorSession({ mode: addFromHome }));
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
  const activeCommitment = useMemo(() => getActiveCommitment(elements), [elements]);
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

  const kindLabel = useCallback(
    (element: ElementDefinition) => t(`kindLabel.${element.kind}`),
    [t],
  );

  const renderElementCard = useCallback(
    (element: ElementDefinition, archived: boolean) => {
      let card: Pick<
        React.ComponentProps<typeof TrackerLibraryCard>,
        'icon' | 'description' | 'onEdit'
      >;
      switch (element.kind) {
        case 'counter': {
          const { config } = element;
          card = {
            icon: config.icon,
            description: counterMetaLines(config)[0],
            onEdit: () => setEditorSession(editorSessionFromCounter(element.id, element.name, config)),
          };
          break;
        }
        case 'habit': {
          const { config } = element;
          card = {
            icon: config.icon,
            description: [
              config.trackingMode === 'timer' ? t('card.timerBadge') : t('card.checkOffBadge'),
              habitMetaLines(config)[0],
            ]
              .filter(Boolean)
              .join(' · '),
            onEdit: () => setEditorSession(editorSessionFromHabit(element.id, element.name, config)),
          };
          break;
        }
        case 'commitment': {
          const { config } = element;
          card = {
            icon: null,
            description: [t('card.commitmentBadge'), config.lockScreenName].join(' · '),
            onEdit: () =>
              setEditorSession(editorSessionFromCommitment(element.id, element.name, config)),
          };
          break;
        }
        default: {
          const unknown: never = element;
          throw new Error(`Unknown tracker kind ${JSON.stringify(unknown)}`);
        }
      }

      return (
        <TrackerLibraryCard
          key={element.id}
          name={element.name}
          {...card}
          archived={archived}
          onHistory={() => navigation.navigate('TrackerHistory', { elementId: element.id })}
          onDelete={() => confirmDelete(element.id, element.name, kindLabel(element))}
          onArchive={archived ? undefined : () => archiveWithUndo(element)}
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
      kindLabel,
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
      switch (parsed.kind) {
        case 'counter':
          await (editingId ? updateCounter(editingId, parsed.input) : createCounter(parsed.input));
          break;
        case 'habit':
          await (editingId ? updateHabit(editingId, parsed.input) : createHabit(parsed.input));
          break;
        case 'commitment':
          await (editingId
            ? updateCommitment(editingId, parsed.input)
            : createCommitment(parsed.input));
          break;
        default: {
          const unknown: never = parsed;
          throw new Error(`Unknown tracker kind ${JSON.stringify(unknown)}`);
        }
      }
      closeEditor();
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
          title={t('screen.commitmentTitle')}
          icon="road-variant"
          count={activeCommitment ? 1 : 0}
          addLabel={t('screen.commitmentAddLabel')}
          // One at a time: a second one is started after the first is archived.
          showAddButton={!activeCommitment}
          onAdd={() => setEditorSession(newEditorSession({ mode: 'commitment' }))}
          emptyMessage={t('screen.commitmentEmpty')}
        >
          {activeCommitment ? renderElementCard(activeCommitment, false) : null}
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
        onSave={(data) => void handleSave(data)}
        onDelete={
          editingElement
            ? () =>
                confirmDelete(
                  editingElement.id,
                  editingElement.name,
                  kindLabel(editingElement),
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
  container: { padding: 16, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
