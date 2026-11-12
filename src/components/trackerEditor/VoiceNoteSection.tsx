import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import QuietText from '../QuietText';
import { requestDictationMicPermission } from '../../dictation/requestMicPermission';
import { formatHabitTimerDuration } from '../../protocol';
import { useVoiceNoteStore } from '../../store/voiceNoteStore';
import { typeScale } from '../../theme/typography';
import { VOICE_NOTE_MAX_SECONDS, voiceNoteUri } from '../../voiceNote/voiceNoteFile';
import FormSection, { formSectionStyles as styles } from './FormSection';

/**
 * One short note in his own voice, recorded here (the phone is unlocked)
 * and played by the native core from the urge screen and the widget's
 * ride. Recording asks for the microphone when it starts; it stops by
 * itself at a minute. Re-recording replaces the note once it is finished.
 */
export default function VoiceNoteSection() {
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const exists = useVoiceNoteStore((s) => s.exists);
  const playing = useVoiceNoteStore((s) => s.playing);
  const [recording, setRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    void useVoiceNoteStore.getState().refresh();
  }, []);

  const fail = (error: unknown) => {
    setRecording(false);
    Alert.alert(
      tCommon('alerts.couldNotSave'),
      error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
    );
  };

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await recorder.stop();
      setRecording(false);
      if (recorder.uri) await useVoiceNoteStore.getState().keep(recorder.uri);
    } catch (error) {
      fail(error);
    } finally {
      finishing.current = false;
    }
  };

  const reachedCap = recording && recorderState.durationMillis >= VOICE_NOTE_MAX_SECONDS * 1000;
  useEffect(() => {
    if (reachedCap) void finish();
    // `finish` reads the recorder at the moment; only the cap moves this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedCap]);

  const start = async () => {
    const granted = await requestDictationMicPermission();
    setMicDenied(!granted);
    if (!granted) return;
    try {
      await useVoiceNoteStore.getState().stop();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      fail(error);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('commitmentFields.voiceNoteDeleteTitle'), undefined, [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      {
        text: t('commitmentFields.voiceNoteDelete'),
        style: 'destructive',
        onPress: () => void useVoiceNoteStore.getState().remove().catch(fail),
      },
    ]);
  };

  // No private files directory (web): nowhere to keep a note.
  if (voiceNoteUri() === null) return null;

  return (
    <FormSection
      title={t('commitmentFields.voiceNoteSectionTitle')}
      description={t('commitmentFields.voiceNoteSectionDescription')}
    >
      {recording ? (
        <View style={styles.timeRow}>
          <Text style={[typeScale.body, styles.switchLabel]} accessibilityLiveRegion="polite">
            {t('commitmentFields.voiceNoteRecording', {
              time: formatHabitTimerDuration(Math.floor(recorderState.durationMillis / 1000)),
              max: formatHabitTimerDuration(VOICE_NOTE_MAX_SECONDS),
            })}
          </Text>
          <Button mode="contained-tonal" icon="stop" onPress={() => void finish()}>
            {t('commitmentFields.voiceNoteStop')}
          </Button>
        </View>
      ) : (
        <View style={styles.chipRow}>
          {exists ? (
            <Button
              mode="contained-tonal"
              icon={playing ? 'stop' : 'play'}
              onPress={() =>
                void (playing ? useVoiceNoteStore.getState().stop() : useVoiceNoteStore.getState().play())
              }
            >
              {playing ? t('commitmentFields.voiceNoteStop') : t('commitmentFields.voiceNotePlay')}
            </Button>
          ) : null}
          <Button mode={exists ? 'text' : 'contained-tonal'} icon="microphone" onPress={() => void start()}>
            {exists ? t('commitmentFields.voiceNoteRecordAgain') : t('commitmentFields.voiceNoteRecord')}
          </Button>
          {exists ? (
            <Button mode="text" icon="delete-outline" onPress={confirmDelete}>
              {t('commitmentFields.voiceNoteDelete')}
            </Button>
          ) : null}
        </View>
      )}
      {micDenied ? (
        <QuietText style={[typeScale.caption, styles.hint]}>
          {t('commitmentFields.voiceNoteMicDenied')}
        </QuietText>
      ) : null}
      <QuietText style={[typeScale.caption, styles.hint]}>
        {t('commitmentFields.voiceNoteNotExported')}
      </QuietText>
    </FormSection>
  );
}
