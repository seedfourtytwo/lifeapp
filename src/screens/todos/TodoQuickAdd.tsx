import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { TODO_TITLE_MAX_LENGTH } from '../../protocol';
import { dictationMicIcon } from '../../dictation/dictationField';
import { livePreviewText } from '../../dictation/livePreview';
import { useDictationField } from '../../dictation/useDictationField';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { ROW_TILE_SIZE } from '../../kinds/TrackerIdentityMark';
import { trackerCardStyles as cardStyles } from '../../kinds/trackerCardStyles';
import { quickAddSubmitAction } from './quickAddSubmit';
import { TODO_TITLE_INSET, TODO_TITLE_OFFSET } from './TodoRow';

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
  /** The field took or lost focus — the page keeps it clear of the keyboard. */
  onFocusChange?: (focused: boolean) => void;
};

/**
 * The last line of the open todos: a plus where a todo's tile stands and a
 * plain input where its words do, written on the page under the rows. A todo
 * filed from it lands as the row just above, so it is seen arriving. Focus
 * shows as an accent underline.
 *
 * It has one trailing slot, so it shows whichever control the line is waiting
 * for: the mic while nothing has been entered, the tick while a take is open,
 * the plus once there is a title to file. Dictation deliberately stops short
 * of creating the todo — a misheard task filed on its own is worse than one
 * more tap, and the plus is already sitting there.
 *
 * Filing keeps the keyboard, so todos can be typed one after another; an
 * empty submit is how the keyboard says "done". Once the keyboard is gone the
 * field lets go of focus too — Android's Back closes the keyboard but leaves
 * the caret, and a focused field reopens the keyboard on the next touch
 * anywhere on the page.
 *
 * Where dictation does not exist — iOS, web, an Android phone without the
 * engine — the mic is absent rather than disabled.
 */
export default function TodoQuickAdd({
  value,
  onChangeText,
  onSubmit,
  dictationActive = true,
  onFocusChange,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('todos');
  const { t: tCommon } = useTranslation('common');

  // This tab stays mounted for the whole app session, and an active field
  // warms the engine — which means loading a 123M-parameter model into memory.
  // Nothing wakes until the mic is pressed; that same press carries the take in
  // through auto-start, so arming and speaking are still one gesture.
  const { decorations: deco } = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  /** When Enter last filed a todo — a hardware Enter submits twice per press. */
  const filedAt = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);
  const changeFocus = (next: boolean) => {
    setFocused(next);
    onFocusChange?.(next);
  };

  useEffect(() => {
    if (!focused) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => inputRef.current?.blur());
    return () => sub.remove();
  }, [focused]);
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

  const submitFromKeyboard = () => {
    const now = Date.now();
    const action = quickAddSubmitAction({
      hasText,
      msSinceFiled: filedAt.current == null ? null : now - filedAt.current,
    });
    if (action === 'file') {
      filedAt.current = now;
      onSubmit();
    } else if (action === 'dismiss') {
      inputRef.current?.blur();
    }
  };

  return (
    <View style={styles.wrap}>
      {/* A todo row's columns: a glyph where the tile stands, words where the title does. */}
      <View style={styles.row}>
        <View style={styles.mark} importantForAccessibility="no" accessibilityElementsHidden>
          <MaterialCommunityIcons name="plus" size={GLYPH} color={theme.colors.onSurfaceVariant} />
        </View>
        <View
          style={[
            styles.field,
            {
              borderBottomWidth: deco.borderWidth,
              // Always there, so focusing moves nothing; it only takes the accent.
              borderBottomColor: focused ? theme.colors.primary : 'transparent',
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={shown}
            onChangeText={(next) => {
              dictation.clearNotices();
              onChangeText(next);
            }}
            placeholder={t('add.placeholder')}
            accessibilityLabel={t('add.placeholder')}
            maxLength={TODO_TITLE_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submitFromKeyboard}
            submitBehavior="submit"
            editable={!dictation.sessionOpen}
            onFocus={() => changeFocus(true)}
            onBlur={() => changeFocus(false)}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            selectionColor={theme.colors.primary}
            cursorColor={theme.colors.primary}
            underlineColorAndroid="transparent"
            textAlignVertical="center"
            style={[typeScale.body, styles.input, { color: theme.colors.onSurface }]}
          />
          {showMic ? (
            <IconButton
              icon={mic.icon}
              size={GLYPH}
              iconColor={theme.colors.onSurfaceVariant}
              disabled={mic.disabled}
              onPress={
                mic.action === 'finish'
                  ? dictation.finish
                  : () => setMicPresses((presses) => presses + 1)
              }
              accessibilityLabel={
                mic.action === 'finish'
                  ? tCommon('dictation.finishA11y')
                  : tCommon('dictation.startA11y')
              }
              style={styles.action}
            />
          ) : hasText ? (
            <IconButton
              icon="plus"
              size={GLYPH}
              iconColor={theme.colors.primary}
              onPress={onSubmit}
              accessibilityLabel={t('add.action')}
              style={styles.action}
            />
          ) : null}
        </View>
      </View>

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

const GLYPH = 22;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: cardStyles.oneLineRow.gap,
    paddingLeft: cardStyles.oneLineRow.paddingLeft,
    paddingRight: cardStyles.oneLineRow.paddingRight,
  },
  mark: {
    width: ROW_TILE_SIZE,
    alignItems: 'center',
  },
  field: {
    flex: 1,
    marginLeft: TODO_TITLE_OFFSET,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: space.sm,
    // The underline already shows focus; the browser's ring drew a frame on web.
    outlineWidth: 0,
  },
  action: {
    margin: 0,
  },
  line: {
    marginTop: space.xs,
    paddingLeft: TODO_TITLE_INSET,
  },
});
