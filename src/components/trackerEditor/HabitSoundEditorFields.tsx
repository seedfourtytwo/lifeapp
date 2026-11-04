import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button } from 'react-native-paper';
import ChoiceChip from '../ChoiceChip';
import QuietText from '../QuietText';
import SegmentedControl from '../SegmentedControl';
import { FilledField } from '../sheet';
import { typeScale } from '../../theme/typography';
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

  const setPlaybackMode = (value: HabitTimerPlaybackMode) => {
    stopPreview();
    onSoundChange({ habitSoundPlaybackMode: value });
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
      <FilledField
        label={t('habitSoundFields.dailyGoalLabel')}
        placeholder={t('habitSoundFields.dailyGoalPlaceholder')}
        value={dailyGoalMinutes}
        onChangeText={onDailyGoalMinutesChange}
        keyboardType="number-pad"
      />
      <View style={styles.switchLabel}>
        <QuietText style={typeScale.caption}>
          {t('habitSoundFields.soundWhileRunningLabel')}
        </QuietText>
        <QuietText style={[typeScale.caption, styles.hint]}>
          {t('habitSoundFields.soundHint')}
        </QuietText>
      </View>
      {BUNDLED_HABIT_SOUND_CATALOG.length === 0 ? (
        <QuietText style={[typeScale.caption, styles.hint]}>
          {t('habitSoundFields.noTracksBundledHint')}
        </QuietText>
      ) : (
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {BUNDLED_HABIT_SOUND_CATALOG.map((track) => (
            <ChoiceChip
              key={track.id}
              label={track.label}
              selected={sound.habitSoundTrackId === track.id}
              onPress={() => selectTrack(track.id)}
            />
          ))}
        </View>
      )}
      <View style={styles.chipRow}>
        <Button
          mode="text"
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
          <Button mode="text" compact icon="close" onPress={clearSound}>
            {t('habitSoundFields.clearSound')}
          </Button>
        ) : null}
      </View>
      {hasSound ? (
        <>
          <QuietText style={typeScale.caption}>
            {t('habitSoundFields.whenTimerRunsLabel')}
          </QuietText>
          <SegmentedControl
            value={sound.habitSoundPlaybackMode}
            onChange={setPlaybackMode}
            options={[
              { value: 'play_once', label: t('habitSoundFields.trackLength') },
              { value: 'loop', label: t('habitSoundFields.loop') },
            ]}
          />
          <QuietText style={[typeScale.caption, styles.hint]}>
            {sound.habitSoundPlaybackMode === 'play_once'
              ? t('habitSoundFields.playOnceHint')
              : t('habitSoundFields.loopHint')}
          </QuietText>
        </>
      ) : null}
    </View>
  );
}
