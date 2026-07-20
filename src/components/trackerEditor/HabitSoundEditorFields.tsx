import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Chip, SegmentedButtons, Text, TextInput } from 'react-native-paper';
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
      Alert.alert('No sound selected', 'Choose a sound track first.');
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
          'Could not play sound',
          'This track is missing from the app build. Reinstall the latest dev APK.',
        );
        return;
      }
      setPreviewPlaying(true);
    } catch (error) {
      if (session !== previewSessionRef.current) return;
      const message = error instanceof Error ? error.message : 'Could not play sound';
      Alert.alert('Could not play sound', message);
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
        label="Daily goal (minutes)"
        placeholder="e.g. 15"
        value={dailyGoalMinutes}
        onChangeText={onDailyGoalMinutesChange}
        keyboardType="number-pad"
        mode="outlined"
        style={styles.field}
      />
      <Text variant="labelMedium" style={styles.inlineLabel}>
        Sound while running
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        Choose a bundled meditation or focus track.
      </Text>
      {BUNDLED_HABIT_SOUND_CATALOG.length === 0 ? (
        <Text variant="bodySmall" style={styles.hint}>
          No tracks bundled yet. Add MP3 files to assets/sounds/ in the project, then rebuild the
          app.
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
          {previewLoading ? 'Loading…' : previewPlaying ? 'Stop preview' : 'Preview sound'}
        </Button>
        {hasSound ? (
          <Chip compact icon="close" onPress={clearSound}>
            Clear sound
          </Chip>
        ) : null}
      </View>
      {hasSound ? (
        <>
          <Text variant="labelMedium" style={styles.inlineLabel}>
            When timer runs
          </Text>
          <SegmentedButtons
            value={sound.habitSoundPlaybackMode}
            onValueChange={setPlaybackMode}
            buttons={[
              { value: 'play_once', label: 'Track length' },
              { value: 'loop', label: 'Loop' },
            ]}
          />
          <Text variant="bodySmall" style={styles.hint}>
            {sound.habitSoundPlaybackMode === 'play_once'
              ? 'Timer stops and logs your session when the track ends — good for guided meditation.'
              : 'Sound loops until you tap Stop.'}
          </Text>
        </>
      ) : null}
    </View>
  );
}
