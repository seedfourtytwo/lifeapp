import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import ChoiceChip from '../ChoiceChip';
import QuietText from '../QuietText';
import { FilledField } from '../sheet';
import {
  DEFAULT_COMMITMENT_LOCK_SCREEN_NAME,
  INSTEAD_HABITS_MAX,
  LOCK_SCREEN_NAME_MAX,
  OWN_LINES_MAX,
  OWN_LINE_MAX_LENGTH,
  RIDE_MINUTE_CHOICES,
} from '../../protocol';
import { useElementStore } from '../../store/elementStore';
import { getActiveHabits } from '../../utils/dashboardElements';
import { typeScale } from '../../theme/typography';
import FormSection, { formSectionStyles as styles } from './FormSection';
import type { CommitmentEditorFieldState } from './types';
import VoiceNoteSection from './VoiceNoteSection';

type Props = {
  state: CommitmentEditorFieldState;
  onChange: (patch: Partial<CommitmentEditorFieldState>) => void;
};

/** His own lines: add and remove, at most five, with a quiet word about the lock screen. */
function OwnLinesSection({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  const theme = useTheme();
  const full = state.ownLines.length >= OWN_LINES_MAX;

  const addDraft = () => {
    const line = state.ownLineDraft.trim();
    if (!line || full) return;
    onChange({ ownLines: [...state.ownLines, line], ownLineDraft: '' });
  };

  return (
    <FormSection
      title={t('commitmentFields.ownLinesSectionTitle')}
      description={t('commitmentFields.ownLinesSectionDescription')}
    >
      {state.ownLines.map((line, index) => (
        <View key={`${index}:${line}`} style={styles.switchRow}>
          <Text style={[typeScale.body, styles.switchLabel]}>{line}</Text>
          <IconButton
            icon="close"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => onChange({ ownLines: state.ownLines.filter((_, at) => at !== index) })}
            accessibilityLabel={t('commitmentFields.removeOwnLineA11y', { line })}
          />
        </View>
      ))}
      {full ? null : (
        <View style={styles.timeRow}>
          <FilledField
            placeholder={t('commitmentFields.ownLinePlaceholder')}
            value={state.ownLineDraft}
            onChangeText={(ownLineDraft) => onChange({ ownLineDraft })}
            onSubmitEditing={addDraft}
            maxLength={OWN_LINE_MAX_LENGTH}
            style={styles.timeField}
          />
          <Button
            mode="text"
            compact
            onPress={addDraft}
            disabled={!state.ownLineDraft.trim()}
            accessibilityLabel={t('commitmentFields.addOwnLineA11y')}
          >
            {t('commitmentFields.addOwnLine')}
          </Button>
        </View>
      )}
      <QuietText style={[typeScale.caption, styles.hint]}>
        {t('commitmentFields.ownLinesLockScreenNote')}
      </QuietText>
    </FormSection>
  );
}

/** When time clear counts from, typed as a local date and time; empty starts it now. */
function ClockSection({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  return (
    <FormSection
      title={t('commitmentFields.clockSectionTitle')}
      description={t('commitmentFields.clockSectionDescription')}
    >
      <View style={styles.timeRow}>
        <FilledField
          label={t('commitmentFields.clearSinceDateLabel')}
          placeholder="2026-03-08"
          value={state.clearSinceDate}
          onChangeText={(clearSinceDate) => onChange({ clearSinceDate })}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={styles.timeField}
        />
        <FilledField
          label={t('commitmentFields.clearSinceTimeLabel')}
          placeholder="21:30"
          value={state.clearSinceTime}
          onChangeText={(clearSinceTime) => onChange({ clearSinceTime })}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={styles.timeField}
        />
      </View>
    </FormSection>
  );
}

/** How long an urge's countdown runs: five to thirty minutes. */
function RideSection({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  return (
    <FormSection
      title={t('commitmentFields.rideSectionTitle')}
      description={t('commitmentFields.rideSectionDescription')}
    >
      <View style={styles.chipRow}>
        {RIDE_MINUTE_CHOICES.map((minutes) => (
          <ChoiceChip
            key={minutes}
            label={t('commitmentFields.rideMinutes', { count: minutes })}
            selected={state.rideMinutes === minutes}
            onPress={() => onChange({ rideMinutes: minutes })}
          />
        ))}
      </View>
    </FormSection>
  );
}

/** Up to two timed habits to start instead; only timers on Home can be picked. */
function InsteadHabitsSection({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const timedHabits = useMemo(
    () =>
      getActiveHabits(elements, dashboard).filter(
        (habit) => habit.config.trackingMode === 'timer',
      ),
    [elements, dashboard],
  );
  const picked = state.insteadHabitIds;

  const toggle = (id: string) => {
    if (picked.includes(id)) {
      onChange({ insteadHabitIds: picked.filter((other) => other !== id) });
    } else if (picked.length < INSTEAD_HABITS_MAX) {
      onChange({ insteadHabitIds: [...picked, id] });
    }
  };

  return (
    <FormSection
      title={t('commitmentFields.insteadSectionTitle')}
      description={t('commitmentFields.insteadSectionDescription')}
    >
      {timedHabits.length === 0 ? (
        <QuietText style={[typeScale.caption, styles.hint]}>
          {t('commitmentFields.insteadNoTimedHabits')}
        </QuietText>
      ) : (
        <View style={styles.chipRow}>
          {timedHabits.map((habit) => (
            <ChoiceChip
              key={habit.id}
              role="checkbox"
              label={habit.name}
              selected={picked.includes(habit.id)}
              onPress={() => toggle(habit.id)}
            />
          ))}
        </View>
      )}
    </FormSection>
  );
}

/**
 * Memoized like the other kinds' fields: the dialog re-renders on every
 * keystroke in the name field, and these props stay the same meanwhile.
 */
function CommitmentEditorFields({ state, onChange }: Props) {
  const { t } = useTranslation('trackers');
  return (
    <>
      <FormSection
        title={t('habitFields.lockScreenSectionTitle')}
        description={t('commitmentFields.lockScreenSectionDescription')}
      >
        <FilledField
          label={t('habitFields.lockScreenNameLabel')}
          placeholder={DEFAULT_COMMITMENT_LOCK_SCREEN_NAME}
          value={state.lockScreenName}
          onChangeText={(lockScreenName) => onChange({ lockScreenName })}
          maxLength={LOCK_SCREEN_NAME_MAX}
        />
      </FormSection>
      <ClockSection state={state} onChange={onChange} />
      <RideSection state={state} onChange={onChange} />
      <OwnLinesSection state={state} onChange={onChange} />
      <InsteadHabitsSection state={state} onChange={onChange} />
      <VoiceNoteSection />
    </>
  );
}

export default React.memo(CommitmentEditorFields);
