import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lifeCore } from '../core/lifeCore';
import { EditorSheet, FilledField } from './sheet';
import CommitmentEditorFields from './trackerEditor/CommitmentEditorFields';
import CounterEditorFields from './trackerEditor/CounterEditorFields';
import { newEditorSession } from './trackerEditor/trackerEditorSession';
import HabitEditorFields from './trackerEditor/HabitEditorFields';
import IconPickerField from './trackerEditor/IconPickerField';
import type {
  CommitmentEditorFieldState,
  TrackerEditorSaveData,
  TrackerEditorSession,
  HabitEditorFieldState,
} from './trackerEditor/types';
import type { TrackerIconId } from '../protocol';

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
    reminderTimes: session.reminderTimes,
    reminderTimeDraft: session.reminderTimeDraft,
    showStreakOnCard: session.showStreakOnCard,
    lockScreenName: session.lockScreenName,
  };
}

function commitmentFieldStateFromSession(session: TrackerEditorSession): CommitmentEditorFieldState {
  return {
    lockScreenName: session.lockScreenName,
    ownLines: session.ownLines,
    ownLineDraft: session.ownLineDraft,
    insteadHabitIds: session.insteadHabitIds,
  };
}

const emptyCommitmentFields = (): CommitmentEditorFieldState =>
  commitmentFieldStateFromSession(newEditorSession({ mode: 'commitment' }));

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
  const { t } = useTranslation('trackers');

  const visible = session !== null;
  const mode = session?.mode ?? 'counter';
  const editingId = session?.editingId ?? null;
  const sessionId = session?.sessionId;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<TrackerIconId | null>(null);
  const [increments, setIncrements] = useState('5, 10');
  const [dailyTarget, setDailyTarget] = useState('');
  const [showStreakOnCard, setShowStreakOnCard] = useState(true);
  const [habitFields, setHabitFields] = useState<HabitEditorFieldState>(emptyHabitFields);
  const [commitmentFields, setCommitmentFields] =
    useState<CommitmentEditorFieldState>(emptyCommitmentFields);

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIcon(session.icon);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setShowStreakOnCard(session.showStreakOnCard);
    setHabitFields(habitFieldStateFromSession(session));
    setCommitmentFields(commitmentFieldStateFromSession(session));
  }, [session, sessionId]);

  /**
   * Stable so HabitEditorFields' memo actually holds — an inline arrow here
   * would give it a new prop on every keystroke and re-render the whole
   * habit form per character.
   */
  const handleHabitFieldsChange = useCallback(
    (patch: Partial<HabitEditorFieldState>) =>
      setHabitFields((current) => ({ ...current, ...patch })),
    [],
  );

  const handleCommitmentFieldsChange = useCallback(
    (patch: Partial<CommitmentEditorFieldState>) =>
      setCommitmentFields((current) => ({ ...current, ...patch })),
    [],
  );

  const closeEditor = () => {
    void lifeCore.stopPreview();
    onDismiss();
  };

  const handleSave = () => {
    void lifeCore.stopPreview();
    switch (mode) {
      case 'counter':
        onSave({ mode: 'counter', name, icon, increments, dailyTarget, showStreakOnCard });
        return;
      case 'habit':
        onSave({ mode: 'habit', name, icon, ...habitFields });
        return;
      case 'commitment':
        onSave({ mode: 'commitment', name, ...commitmentFields });
        return;
      default: {
        const unknown: never = mode;
        throw new Error(`Unknown editor mode ${String(unknown)}`);
      }
    }
  };

  const title = useMemo(() => {
    switch (mode) {
      case 'counter':
        return editingId ? t('editor.editCounterTitle') : t('editor.newCounterTitle');
      case 'habit':
        return editingId ? t('editor.editHabitTitle') : t('editor.newHabitTitle');
      case 'commitment':
        return editingId ? t('editor.editCommitmentTitle') : t('editor.newCommitmentTitle');
      default: {
        const unknown: never = mode;
        throw new Error(`Unknown editor mode ${String(unknown)}`);
      }
    }
  }, [editingId, mode, t]);

  const busy = saving || deleting;

  return (
    <EditorSheet
      visible={visible}
      onDismiss={closeEditor}
      dismissable={!busy}
      title={title}
      primaryAction={{
        label: t('editor.save'),
        onPress: handleSave,
        disabled: !name.trim() || busy,
        loading: saving,
      }}
      destructiveAction={
        editingId && onDelete
          ? { accessibilityLabel: t('editor.delete'), onPress: onDelete, disabled: busy }
          : undefined
      }
    >
      <FilledField
        placeholder={t('editor.nameLabel')}
        value={name}
        onChangeText={setName}
        autoCorrect={false}
        // A label like "Name" invites Android autofill to re-fill the field
        // mid-edit, which duplicates text the same way a lagging controlled
        // value does. Belt and braces alongside the memoized form below.
        autoComplete="off"
      />

      {/* A commitment is shown by name, and by its lock-screen name only when locked. */}
      {mode === 'commitment' ? null : <IconPickerField value={icon} onChange={setIcon} />}

      {mode === 'commitment' ? (
        <CommitmentEditorFields state={commitmentFields} onChange={handleCommitmentFieldsChange} />
      ) : mode === 'counter' ? (
        <CounterEditorFields
          increments={increments}
          dailyTarget={dailyTarget}
          showStreakOnCard={showStreakOnCard}
          onIncrementsChange={setIncrements}
          onDailyTargetChange={setDailyTarget}
          onShowStreakOnCardChange={setShowStreakOnCard}
        />
      ) : session && mode === 'habit' ? (
        <HabitEditorFields state={habitFields} onChange={handleHabitFieldsChange} />
      ) : null}
    </EditorSheet>
  );
}
