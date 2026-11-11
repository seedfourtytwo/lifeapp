import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stopHabitSound } from '../audio/habitTimerSound';
import { EditorSheet, FilledField } from './sheet';
import CounterEditorFields from './trackerEditor/CounterEditorFields';
import { newEditorSession } from './trackerEditor/trackerEditorSession';
import HabitEditorFields from './trackerEditor/HabitEditorFields';
import IconPickerField from './trackerEditor/IconPickerField';
import type {
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

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIcon(session.icon);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setShowStreakOnCard(session.showStreakOnCard);
    setHabitFields(habitFieldStateFromSession(session));
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

  const closeEditor = () => {
    void stopHabitSound();
    onDismiss();
  };

  const handleSave = () => {
    void stopHabitSound();
    if (mode === 'counter') {
      onSave({ mode: 'counter', name, icon, increments, dailyTarget, showStreakOnCard });
      return;
    }
    onSave({
      mode: 'habit',
      name,
      icon,
      ...habitFields,
    });
  };

  const title = useMemo(() => {
    if (mode === 'counter') {
      return editingId ? t('editor.editCounterTitle') : t('editor.newCounterTitle');
    }
    return editingId ? t('editor.editHabitTitle') : t('editor.newHabitTitle');
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

      <IconPickerField value={icon} onChange={setIcon} />

      {mode === 'counter' ? (
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
