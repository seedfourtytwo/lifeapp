import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { TODO_TITLE_MAX_LENGTH } from '../../protocol';
import { dictationMicIcon } from '../../dictation/dictationField';
import { livePreviewText } from '../../dictation/livePreview';
import { useDictationField } from '../../dictation/useDictationField';
import { space } from '../../theme/spacing';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /** File the draft as a todo. */
  onSubmit: () => void;
  /**
   * False while another surface owns the mic — the editor dialog on top of
   * this screen — so an open take is dropped rather than left running behind it.
   */
  dictationActive?: boolean;
};

/**
 * The one-line composer at the top of the Todos tab.
 *
 * A dense field has one trailing slot, so it shows whichever control the field
 * is waiting for: the mic while nothing has been entered, the tick while a take
 * is open, the plus once there is a title to file. Dictation deliberately stops
 * short of creating the todo — a misheard task filed on its own is worse than
 * one more tap, and the plus is already sitting there.
 *
 * Where dictation does not exist — iOS, web, an Android phone without the
 * engine — the mic is absent rather than disabled, and the field is exactly
 * what it was before.
 */
export default function TodoQuickAdd({
  value,
  onChangeText,
  onSubmit,
  dictationActive = true,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('todos');
  const { t: tCommon } = useTranslation('common');

  // This tab stays mounted for the whole app session, and an active field
  // warms the engine — which means loading a 123M-parameter model into memory.
  // Nothing wakes until the mic is pressed; that same press carries the take in
  // through auto-start, so arming and speaking are still one gesture.
  const [micPresses, setMicPresses] = useState(0);
  const armed = micPresses > 0;

  const dictation = useDictationField({
    value,
    onChangeText,
    maxLength: TODO_TITLE_MAX_LENGTH,
    join: 'inline',
    active: dictationActive && armed,
    autoStart: armed,
    autoStartToken: armed ? `todo-quick-add:${micPresses}` : null,
    truncatedNotice: t('add.dictationTruncated'),
  });

  const hasText = value.trim().length > 0;
  const mic = dictationMicIcon({
    starting: dictation.starting,
    sessionOpen: dictation.sessionOpen,
    finishing: dictation.finishing,
    // Asleep is not unavailable — an un-armed field reports the mic as blocked
    // only because nothing has woken it yet.
    micDisabled: armed && dictation.micDisabled,
  });
  const showMic = dictation.supported && (!hasText || dictation.busy);
  const heard = dictation.sessionOpen ? livePreviewText(dictation.live) : '';
  const shown = heard ? (value.trimEnd() ? `${value.trimEnd()} ${heard}` : heard) : value;
  const line = dictation.error
    ? { text: dictation.error, tone: 'error' as const }
    : (dictation.status && { text: dictation.status.message, tone: 'notice' as const }) ||
      dictation.notice;

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        dense
        value={shown}
        onChangeText={(next) => {
          dictation.clearNotices();
          onChangeText(next);
        }}
        placeholder={t('add.placeholder')}
        maxLength={TODO_TITLE_MAX_LENGTH}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        blurOnSubmit={false}
        editable={!dictation.sessionOpen}
        right={
          showMic ? (
            <TextInput.Icon
              icon={mic.icon}
              disabled={mic.disabled}
              onPress={
                mic.action === 'finish'
                  ? dictation.finish
                  : () => setMicPresses((presses) => presses + 1)
              }
              // The mic is about to dismiss the keyboard; do not raise it first.
              forceTextInputFocus={false}
              accessibilityLabel={
                mic.action === 'finish'
                  ? tCommon('dictation.finishA11y')
                  : tCommon('dictation.startA11y')
              }
            />
          ) : hasText ? (
            <TextInput.Icon icon="plus" onPress={onSubmit} accessibilityLabel={t('add.action')} />
          ) : undefined
        }
      />

      {line ? (
        line.tone === 'error' ? (
          <Text
            variant="bodySmall"
            accessibilityLiveRegion="polite"
            style={[styles.line, { color: theme.colors.error }]}
          >
            {line.text}
          </Text>
        ) : (
          <QuietText variant="bodySmall" accessibilityLiveRegion="polite" style={styles.line}>
            {line.text}
          </QuietText>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.lg,
  },
  line: {
    marginTop: space.xs,
  },
});
