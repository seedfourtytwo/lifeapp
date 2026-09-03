import React from 'react';
import { StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import type { DictationLivePreview } from '../dictation/livePreview';
import { NoteEditorPreview } from './NoteEditorPreview';
import { NOTE_BODY_MAX_LENGTH, clampNoteBody } from './noteBodyLimits';

type Props = {
  /** True while the keyboard has the body; false shows the read/dictate preview. */
  textEditing: boolean;
  isJournal: boolean;
  noun: string;
  placeholder: string;
  /** Remount key — a new session or an undo reseeds the uncontrolled field. */
  fieldKey: string;
  /** Initial text for the uncontrolled field. */
  fieldSeed: string;
  draft: string;
  live: DictationLivePreview | null;
  listening: boolean;
  capturing: boolean;
  dictationBusy: boolean;
  /** Text added by the last take, so review can tint it. */
  reviewHighlight: { base: string; added: string } | null;
  minHeight: number;
  maxHeight: number;
  saving: boolean;
  onChangeText: (next: string) => void;
  onEdit: () => void;
};

/**
 * The body, in whichever of its two states it is in: an uncontrolled
 * `TextInput` while typing, the preview the rest of the time.
 *
 * They are one unit because they occupy one slot and share their height — the
 * sheet works out how tall the body may be from the window, and both halves
 * have to honour the same floor and ceiling or the sheet jumps when the
 * keyboard opens.
 */
export default function NoteEditorBody({
  textEditing,
  isJournal,
  noun,
  placeholder,
  fieldKey,
  fieldSeed,
  draft,
  live,
  listening,
  capturing,
  dictationBusy,
  reviewHighlight,
  minHeight,
  maxHeight,
  saving,
  onChangeText,
  onEdit,
}: Props) {
  if (textEditing && !dictationBusy) {
    return (
      <TextInput
        key={fieldKey}
        mode="outlined"
        multiline
        numberOfLines={isJournal ? 8 : 6}
        defaultValue={fieldSeed}
        onChangeText={(next) => onChangeText(clampNoteBody(next))}
        style={[styles.input, { minHeight, maxHeight }]}
        contentStyle={styles.inputContent}
        disabled={saving}
        autoFocus
        maxLength={NOTE_BODY_MAX_LENGTH}
        autoCorrect
        autoCapitalize="sentences"
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        spellCheck
      />
    );
  }

  return (
    <NoteEditorPreview
      noun={noun}
      isJournal={isJournal}
      draft={draft}
      live={live}
      listening={listening}
      capturing={capturing}
      reviewHighlight={reviewHighlight}
      placeholder={placeholder}
      minHeight={minHeight}
      maxHeight={maxHeight}
      saving={saving}
      editLocked={dictationBusy}
      onEdit={onEdit}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 144,
    maxHeight: 280,
  },
  inputContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
});
