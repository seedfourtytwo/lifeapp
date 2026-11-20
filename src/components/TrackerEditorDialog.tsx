import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type NativeMethods, type ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { stopHabitSound } from '../audio/habitTimerSound';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { space } from '../theme/spacing';
import {
  parseTrackerEditorSave,
  type TrackerEditorField,
  type TrackerEditorProblem,
  type TrackerEditorSaved,
} from '../utils/parseTrackerEditorSave';
import { COLLAPSE_MS } from './Collapsible';
import SegmentedControl from './SegmentedControl';
import { EditorSheet, FilledField } from './sheet';
import CounterEditorFields from './trackerEditor/CounterEditorFields';
import { newEditorSession } from './trackerEditor/trackerEditorSession';
import HabitEditorFields from './trackerEditor/HabitEditorFields';
import IconPickerField from './trackerEditor/IconPickerField';
import type {
  TrackerEditorMode,
  TrackerEditorSession,
  HabitEditorFieldState,
} from './trackerEditor/types';
import type { TrackerIconId } from '../protocol';

type Props = {
  session: TrackerEditorSession | null;
  saving: boolean;
  deleting?: boolean;
  onDismiss: () => void;
  /** Only ever called with something that passed validation. */
  onSave: (saved: TrackerEditorSaved) => void;
  onDelete?: () => void;
};

type Anchor = Pick<NativeMethods, 'measureLayout'>;

/** A section that had to open for the problem needs to finish before it can be scrolled to. */
const SCROLL_TO_PROBLEM_MS = COLLAPSE_MS + 60;

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
    scheduleTimesPerWeek: session.scheduleTimesPerWeek,
    useReminder: session.useReminder,
    remindMinutesBefore: session.remindMinutesBefore,
    showStreakOnCard: session.showStreakOnCard,
    anySessionCounts: session.anySessionCounts,
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
  const reduceMotion = useReduceMotion();

  const visible = session !== null;
  // The sheet keeps what it was showing while it slides shut.
  const shown = useRef(session);
  if (session) shown.current = session;
  const current = shown.current;
  const editingId = current?.editingId ?? null;
  const sessionId = session?.sessionId;

  /**
   * A new tracker picks its kind in the sheet; an existing one keeps its own.
   * The pick is tied to the session it was made in, so the next sheet opens on
   * the kind it was asked for rather than the last one chosen.
   */
  const [pickedKind, setPickedKind] = useState<{
    sessionId: string;
    mode: TrackerEditorMode;
  } | null>(null);
  const mode: TrackerEditorMode =
    current && pickedKind?.sessionId === current.sessionId
      ? pickedKind.mode
      : (current?.mode ?? 'habit');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<TrackerIconId | null>(null);
  const [increments, setIncrements] = useState('5, 10');
  const [dailyTarget, setDailyTarget] = useState('');
  const [showStreakOnCard, setShowStreakOnCard] = useState(true);
  const [habitFields, setHabitFields] = useState<HabitEditorFieldState>(emptyHabitFields);
  /** What the last Save could not accept, shown under the field at fault. */
  const [problem, setProblem] = useState<TrackerEditorProblem | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const formRef = useRef<View>(null);
  const anchors = useRef(new Map<TrackerEditorField, Anchor>());
  const anchorSetters = useRef(new Map<TrackerEditorField, (node: Anchor | null) => void>());

  /** Stable per field, so a memoized form is not handed a new ref each render. */
  const anchorRef = useCallback((field: TrackerEditorField) => {
    const known = anchorSetters.current.get(field);
    if (known) return known;
    const setter = (node: Anchor | null) => {
      if (node) anchors.current.set(field, node);
      else anchors.current.delete(field);
    };
    anchorSetters.current.set(field, setter);
    return setter;
  }, []);

  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setIcon(session.icon);
    setIncrements(session.increments);
    setDailyTarget(session.dailyTarget);
    setShowStreakOnCard(session.showStreakOnCard);
    setHabitFields(habitFieldStateFromSession(session));
  }, [session, sessionId]);

  // Any edit withdraws the complaint: it is about what was saved, not what is typed now.
  useEffect(() => {
    setProblem(null);
  }, [mode, increments, dailyTarget, habitFields]);

  useEffect(() => {
    if (!problem) return;
    const timer = setTimeout(() => {
      const anchor = anchors.current.get(problem.field);
      const form = formRef.current;
      if (!anchor || !form) return;
      anchor.measureLayout(form, (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: !reduceMotion });
      });
    }, SCROLL_TO_PROBLEM_MS);
    return () => clearTimeout(timer);
    // A new problem is what scrolls; the motion setting changing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

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
    const result = parseTrackerEditorSave(
      mode === 'counter'
        ? { mode: 'counter', name, icon, increments, dailyTarget, showStreakOnCard }
        : { mode: 'habit', name, icon, ...habitFields },
    );
    if (!result.ok) {
      setProblem({ field: result.field, message: result.message });
      return;
    }
    onSave(result);
  };

  const title = useMemo(() => {
    if (!editingId) return t('editor.newTrackerTitle');
    return mode === 'counter' ? t('editor.editCounterTitle') : t('editor.editHabitTitle');
  }, [editingId, mode, t]);

  const kindOptions = useMemo(
    () =>
      [
        { value: 'habit', label: t('editor.kindHabit') },
        { value: 'counter', label: t('editor.kindCounter') },
      ] as const,
    [t],
  );

  const busy = saving || deleting;

  return (
    <EditorSheet
      visible={visible}
      onDismiss={closeEditor}
      dismissable={!busy}
      title={title}
      scrollRef={scrollRef}
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
      <View ref={formRef} collapsable={false} style={styles.form}>
        {editingId ? null : (
          <SegmentedControl
            value={mode}
            onChange={(next) => {
              if (current) setPickedKind({ sessionId: current.sessionId, mode: next });
            }}
            options={kindOptions}
          />
        )}

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
            problem={problem}
            anchorRef={anchorRef}
          />
        ) : (
          <HabitEditorFields
            state={habitFields}
            onChange={handleHabitFieldsChange}
            problem={problem}
            anchorRef={anchorRef}
          />
        )}
      </View>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  /** One child of the scrolling body, so a field's place is measured against it. */
  form: {
    gap: space.lg,
  },
});
