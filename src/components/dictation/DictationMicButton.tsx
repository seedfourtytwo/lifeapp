import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton, useTheme } from 'react-native-paper';
import {
  DictationMicHalo,
  DICTATION_ARMED_FILL,
  DICTATION_ARMED_FILL_DARK,
  DICTATION_LIVE_COLOR,
  DICTATION_LIVE_COLOR_DARK,
  DICTATION_LIVE_FILL,
  DICTATION_LIVE_FILL_DARK,
  DICTATION_PRESENCE_COLOR,
  DICTATION_PRESENCE_COLOR_DARK,
} from './DictationPresence';
import type { DictationFieldPresence } from '../../dictation/useDictationField';

type Props = {
  /** Live session state, straight from `useDictationField`. */
  field: DictationFieldPresence;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Standing mic for a full-size editor — a note, a journal entry. Transcript
 * only; no audio is stored. Lives in the thumb row next to Done/Save.
 *
 * Dense inputs use their own trailing-icon mic instead: Paper checks the
 * identity of a `TextInput`'s adornment, so that one has to be a real
 * `TextInput.Icon` element and cannot be this button.
 */
export default function DictationMicButton({
  field: { listening, capturing, starting, finishing, sessionOpen },
  disabled = false,
  onPress,
}: Props) {
  const { t } = useTranslation('common');
  const theme = useTheme();

  const busy = disabled || starting;
  const live = listening || starting || finishing;
  const hearing = capturing && listening && !finishing;
  const idleMicColor = theme.colors.onSurfaceVariant;
  const armedInk = theme.dark ? DICTATION_PRESENCE_COLOR_DARK : DICTATION_PRESENCE_COLOR;
  const liveInk = theme.dark ? DICTATION_LIVE_COLOR_DARK : DICTATION_LIVE_COLOR;
  const armedFill = theme.dark ? DICTATION_ARMED_FILL_DARK : DICTATION_ARMED_FILL;
  const liveFill = theme.dark ? DICTATION_LIVE_FILL_DARK : DICTATION_LIVE_FILL;
  const ink = hearing ? liveInk : armedInk;
  const fill = hearing ? liveFill : armedFill;

  return (
    <View style={styles.row} collapsable={false}>
      <DictationMicHalo
        preparing={starting}
        listening={listening}
        capturing={hearing}
        finishing={finishing}
        color={armedInk}
        liveColor={liveInk}
      >
        <IconButton
          icon={live ? 'microphone' : 'microphone-outline'}
          size={22}
          mode={live ? 'contained' : 'outlined'}
          containerColor={live ? fill : undefined}
          iconColor={live ? ink : idleMicColor}
          onPress={onPress}
          disabled={busy || sessionOpen || finishing}
          accessibilityLabel={t('note.dictateWithMic')}
          style={styles.mic}
        />
      </DictationMicHalo>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  mic: {
    margin: 0,
  },
});
