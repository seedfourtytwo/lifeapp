import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorSheet, FilledField } from '../../components/sheet';
import { parseEveningCheckInTime } from '../../protocol/appSettings';

type Props = {
  visible: boolean;
  /** The stored time, HH:mm. */
  value: string;
  onDismiss: () => void;
  /** Called with a strict HH:mm; the sheet closes once it resolves. */
  onSave: (time: string) => Promise<void>;
};

/**
 * Where the evening check-in's time is typed: one field, taken the way the
 * tracker editor takes a time window — "20:00", "8:30" or "2000" all do — and
 * refused with a sentence when it is not a time of day.
 */
export default function CheckInTimeSheet({ visible, value, onDismiss, onSave }: Props) {
  const { t } = useTranslation('settings');
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setError(null);
    setSaving(false);
  }, [visible, value]);

  const handleSave = async () => {
    const time = parseEveningCheckInTime(draft);
    if (time == null) {
      setError(t('reminders.timeInvalid'));
      return;
    }
    setSaving(true);
    try {
      await onSave(time);
      onDismiss();
    } catch {
      setError(t('reminders.timeNotSaved'));
      setSaving(false);
    }
  };

  return (
    <EditorSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!saving}
      title={t('reminders.timeTitle')}
      primaryAction={{
        label: t('common:actions.save'),
        onPress: () => void handleSave(),
        disabled: saving,
      }}
    >
      <FilledField
        accessibilityLabel={t('reminders.timeTitle')}
        placeholder={t('reminders.timePlaceholder')}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setError(null);
        }}
        error={error}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        onSubmitEditing={() => void handleSave()}
      />
    </EditorSheet>
  );
}
