import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Chip, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  playHabitSound,
  preloadHabitSound,
  stopHabitSound,
  warmupHabitSoundPlayback,
} from '../../audio/habitTimerSound';
import {
  BUNDLED_HABIT_SOUND_CATALOG,
  buildHabitTimerSound,
  type HabitTimerPlaybackMode,
} from '../../protocol';
import { formSectionStyles as styles } from './FormSection';

type SoundFieldState = {
  habitSoundTrackId: string;
  habitSoundPlaybackMode: HabitTimerPlaybackMode;
};

type Props = {
  dailyGoalMinutes: string;
  sound: SoundFieldState;
  onDailyGoalMinutesChange: (value: string) => void;
  onSoundChange: (patch: Partial<SoundFieldState>) => void;
};

export default function HabitSoundEditorFields({
  dailyGoalMinutes,
  sound,
  onDailyGoalMinutesChange,
  onSoundChange,
}: Props) {
  const { t } = useTranslation('trackers');
  const { t: tCommon } = useTranslation('common');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSessionRef = useRef(0);

  const buildPreviewSound = useCallback(
    () =>
      buildHabitTimerSound({
        trackId: sound.habitSoundTrackId,
        playbackMode: sound.habitSoundPlaybackMode,
      }),
    [sound.habitSoundTrackId, sound.habitSoundPlaybackMode],
  );

  const stopPreview = useCallback(() => {
    previewSessionRef.current += 1;
    void stopHabitSound();
    setPreviewPlaying(false);
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    void warmupHabitSoundPlayback();
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  useEffect(() => {
    if (!sound.habitSoundTrackId.trim()) return;
    void preloadHabitSound(buildPreviewSound());
  }, [buildPreviewSound, sound.habitSoundTrackId]);

  const hasSound = Boolean(sound.habitSoundTrackId.trim());

  const handlePreviewSound = async () => {
    if (previewPlaying) {
      stopPreview();
      return;
    }

    const previewSound = buildPreviewSound();
    if (!previewSound) {
      Alert.alert(t('habitSoundFields.noSoundSelectedTitle'), t('habitSoundFields.noSoundSelectedBody'));
      return;
    }

    const session = previewSessionRef.current;
    setPreviewLoading(true);
    try {
      const started = await playHabitSound(previewSound, {
        onEnded: () => {
          if (session !== previewSessionRef.current) return;
          setPreviewPlaying(false);
          setPreviewLoading(false);
        },
      });
      if (session !== previewSessionRef.current) return;
      if (!started) {
        Alert.alert(
          t('habitSoundFields.couldNotPlaySoundTitle'),
          t('habitSoundFields.couldNotPlaySoundMissingBody'),
        );
        return;
      }
      setPreviewPlaying(true);
    } catch (error) {
      if (session !== previewSessionRef.current) return;
      const message =
        error instanceof Error ? error.message : tCommon('errors.somethingWentWrong');
      Alert.alert(t('habitSoundFields.couldNotPlaySoundTitle'), message);
    } finally {
      if (session === previewSessionRef.current) {
        setPreviewLoading(false);
      }
    }
  };

  const setPlaybackMode = (value: string) => {
    if (!value) return;
    stopPreview();
    onSoundChange({ habitSoundPlaybackMode: value as HabitTimerPlaybackMode });
  };

  const selectTrack = (trackId: string) => {
    stopPreview();
    onSoundChange({
      habitSoundTrackId: sound.habitSoundTrackId === trackId ? '' : trackId,
    });
  };

  const clearSound = () => {
    stopPreview();
    onSoundChange({ habitSoundTrackId: '' });
  };

  return (
    <View style={styles.sectionBody}>
      <TextInput
        label={t('habitSoundFields.dailyGoalLabel')}
        placeholder={t('habitSoundFields.dailyGoalPlaceholder')}
        value={dailyGoalMinutes}
        onChangeText={onDailyGoalMinutesChange}
        keyboardType="number-pad"
        mode="outlined"
        style={styles.field}
      />
      <Text variant="labelMedium" style={styles.inlineLabel}>
        {t('habitSoundFields.soundWhileRunningLabel')}
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        {t('habitSoundFields.soundHint')}
      </Text>
      {BUNDLED_HABIT_SOUND_CATALOG.length === 0 ? (
        <Text variant="bodySmall" style={styles.hint}>
          {t('habitSoundFields.noTracksBundledHint')}
        </Text>
      ) : (
        <View style={[styles.chipRow, styles.sectionBody]}>
          {BUNDLED_HABIT_SOUND_CATALOG.map((track) => (
            <Chip
              key={track.id}
              selected={sound.habitSoundTrackId === track.id}
              onPress={() => selectTrack(track.id)}
              compact
            >
              {track.label}
            </Chip>
          ))}
        </View>
      )}
      <View style={styles.chipRow}>
        <Button
          mode="outlined"
          icon={previewPlaying ? 'stop' : previewLoading ? undefined : 'play-circle-outline'}
          compact
          loading={previewLoading}
          onPress={() => void handlePreviewSound()}
          disabled={!hasSound || previewLoading}
        >
          {previewLoading
            ? t('habitSoundFields.loading')
            : previewPlaying
              ? t('habitSoundFields.stopPreview')
              : t('habitSoundFields.previewSound')}
        </Button>
        {hasSound ? (
          <Chip compact icon="close" onPress={clearSound}>
            {t('habitSoundFields.clearSound')}
          </Chip>
        ) : null}
      </View>
      {hasSound ? (
        <>
          <Text variant="labelMedium" style={styles.inlineLabel}>
            {t('habitSoundFields.whenTimerRunsLabel')}
          </Text>
          <SegmentedButtons
            value={sound.habitSoundPlaybackMode}
            onValueChange={setPlaybackMode}
            buttons={[
              { value: 'play_once', label: t('habitSoundFields.trackLength') },
              { value: 'loop', label: t('habitSoundFields.loop') },
            ]}
          />
          <Text variant="bodySmall" style={styles.hint}>
            {sound.habitSoundPlaybackMode === 'play_once'
              ? t('habitSoundFields.playOnceHint')
              : t('habitSoundFields.loopHint')}
          </Text>
        </>
      ) : null}
    </View>
  );
}
