import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, useTheme } from 'react-native-paper';
import {
  useNoteDictationController,
  type NoteDictationControllerProps,
} from '../../dictation/useNoteDictationController';
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

type Props = NoteDictationControllerProps;

/**
 * Mic for notes and journals. Transcript only — no audio is stored.
 */
export default function NoteDictationButton(props: Props) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { listening, capturing, starting, finishing, sessionOpen, start, finish, supported } =
    useNoteDictationController(props);

  if (!supported) {
    return null;
  }

  const busy = Boolean(props.disabled) || props.active === false || starting;
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
      {sessionOpen ? (
        <Button
          mode="contained-tonal"
          compact
          onPress={finish}
          disabled={starting || finishing}
          accessibilityLabel={t('note.finishDictation')}
        >
          {t('actions.done')}
        </Button>
      ) : null}
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
          onPress={() => void start()}
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
    gap: 8,
    overflow: 'visible',
  },
  mic: {
    margin: 0,
  },
});
