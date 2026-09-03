import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { NOTE_BODY_APPROACHING_REMAINING, NOTE_BODY_MAX_LENGTH } from './noteBodyLimits';
import { NoteEditorActions } from './NoteEditorActions';
import { NoteEditorHistoryBar } from './NoteEditorHistoryBar';
import NoteEditorBody from './NoteEditorBody';
import NoteEditorChapterBar from './NoteEditorChapterBar';
import NoteEditorChapterPicker from './NoteEditorChapterPicker';
import NoteEditorDictationStatus from './NoteEditorDictationStatus';
import NoteEditorHeader from './NoteEditorHeader';
import NoteEditorLimitNotice from './NoteEditorLimitNotice';
import { confirmClearNoteBody, confirmDeleteChapter } from './noteEditorPrompts';
import { useNoteEditorChrome } from './useNoteEditorChrome';
import { useNoteEditorPersist } from './useNoteEditorPersist';
import { useNoteEditorExport } from './useNoteEditorExport';
import {
  activeJournalChapterId,
  journalChapterIndex,
  type JournalChapter,
} from './journalChapters';
import { splitAddedTake } from '../utils/appendTranscript';
import { formatFullDate } from '../utils/dates';
import DictationMicButton from '../components/dictation/DictationMicButton';
import { useDictationField } from '../dictation/useDictationField';
import type { TrackerIconId } from '../protocol';
import {
  canShowNoteShare,
  NOTE_SHARE_STALE_DARK,
  NOTE_SHARE_STALE_LIGHT,
  noteShareActionColor,
} from './noteShareStatus';

export type NoteEditorSheetProps = {
  visible: boolean;
  date: string | null;
  /** Sheet title — notebook or tracker name. */
  heading?: string;
  kind?: 'note' | 'journal';
  /** Optional glyph beside a journal title. */
  headingIcon?: TrackerIconId;
  trackerName: string;
  initialBody: string;
  /** Last successfully shared body fingerprint for a tracker day note. */
  shareFingerprint?: string | null;
  /** Last shared fingerprint per journal chapter id — one per chapter, not per day. */
  chapterShareFingerprints?: Readonly<Record<string, string>>;
  /** Changes when target, day or chapter changes — reseeds the draft. */
  sessionKey?: string | null;
  autoStartDictation?: boolean;
  saving?: boolean;
  /** The day's chapters on file, first to last. Empty for a tracker note. */
  chapters?: readonly JournalChapter[];
  /** Row id of the chapter on screen; null means "the day's first". */
  activeChapterId?: string | null;
  onDismiss: () => void;
  /** Checkpoint to SQLite without closing. */
  onPersist?: (body: string) => void;
  onSave: (body: string) => void;
  /** `chapterIds` null means the whole day — a tracker note, or nothing to choose. */
  onShare?: (body: string, chapterIds: string[] | null) => void | Promise<void>;
  /** Move to another chapter, handing over the draft on screen to be written first. */
  onSelectChapter?: (id: string, body: string) => void;
  /** Start a new chapter, handing over the draft on screen to be written first. */
  onAddChapter?: (body: string) => void;
  onDeleteChapter?: () => void;
};

/** Stable default so the picker's memos do not see a new object every render. */
const EMPTY_CHAPTER_FINGERPRINTS: Readonly<Record<string, string>> = Object.freeze({});

const DICTATION_WAKE_TAG = 'lifeapp-note-dictation';
const SHEET_MAX_WIDTH = 400;
const SHEET_GUTTER = 24;

function DictationKeepAwake() {
  useKeepAwake(DICTATION_WAKE_TAG);
  return null;
}

/**
 * Shared editor for tracker notes and the daily journal.
 * Mic-first preview; tap the body to type. Header X dismisses.
 * Done stops the mic; Save writes and closes when there is draft text.
 *
 * For a journal this edits *one chapter* of a notebook day. Taking text out of
 * it — share, copy, and the never/stale/current colour — spans the day, and
 * the reader chooses which chapters go: `useNoteEditorExport` owns that.
 *
 * What is left here is the orchestration: the header, chapter bar, body, limit
 * banner, action row and chapter picker are each their own file, and the mic,
 * the draft, the chrome and the export are each their own hook.
 */
export default function NoteEditorSheet({
  visible,
  date,
  heading,
  kind = 'note',
  headingIcon,
  sessionKey = null,
  trackerName,
  initialBody,
  shareFingerprint = null,
  chapterShareFingerprints = EMPTY_CHAPTER_FINGERPRINTS,
  autoStartDictation = false,
  saving = false,
  chapters = [],
  activeChapterId = null,
  onDismiss,
  onPersist,
  onSave,
  onShare,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
}: NoteEditorSheetProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('common');
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(SHEET_MAX_WIDTH, Math.max(280, windowWidth - SHEET_GUTTER * 2));
  const previewMaxHeight = Math.round(Math.min(windowHeight * 0.52, windowHeight - 320));
  const previewMinHeight = Math.round(Math.min(windowHeight * 0.28, previewMaxHeight));

  const persist = useNoteEditorPersist({
    visible,
    date,
    sessionKey,
    initialBody,
    onPersist,
  });

  const isJournal = kind === 'journal';
  const noun = isJournal ? t('note.journalNoun') : t('note.noteNoun');

  // Everything about dictating into the body — session, budget, notices, mic
  // state — belongs to the shared field unit. What is left here is note-shaped:
  // a take is committed through the draft's own persist path, and leaving text
  // editing when the mic opens.
  const dictation = useDictationField({
    value: persist.draft,
    onChangeText: (next) => {
      persist.remountField(next);
      persist.persistDraft(next);
    },
    maxLength: NOTE_BODY_MAX_LENGTH,
    active: visible,
    disabled: saving,
    autoStart: autoStartDictation,
    autoStartToken: autoStartDictation && sessionKey ? `${sessionKey}:dictate` : null,
    truncatedNotice: isJournal
      ? t('note.dictationHintTruncatedJournal')
      : t('note.dictationHintTruncatedNote'),
    onSessionChange: (open) => {
      if (open) persist.setTextEditing(false);
    },
    onFinished: () => {
      // Opened by a tracker's mic button and nothing was said: get out of the way.
      if (!autoStartDictation || saving) return;
      if (!persist.draftRef.current.trim()) {
        onDismiss();
      }
    },
  });

  // Both are stable for the life of the sheet, so the chrome's session effect
  // can depend on them without re-running every render.
  const { reset: dictationReset, clearNotices: clearDictationNotices } = dictation;

  const chrome = useNoteEditorChrome({
    visible,
    date,
    sessionKey,
    onResetDictation: dictationReset,
    onClearDictationNotices: clearDictationNotices,
  });

  const listening = dictation.sessionOpen;
  const dictationBusy = dictation.busy;
  const historyLocked = saving || chrome.sharing || dictationBusy;

  const hasStoredNote = initialBody.trim().length > 0;
  const hasDraftText = persist.draft.trim().length > 0;
  const liveChars = dictation.liveChars;
  const remaining = Math.max(0, NOTE_BODY_MAX_LENGTH - persist.draft.length - liveChars);
  const showClear = listening
    ? hasDraftText || liveChars > 0
    : hasStoredNote || hasDraftText;
  const showDone = dictation.starting || listening || dictation.finishing;

  // Chapter geometry. An unset id means the day's first chapter, not a new one.
  // A chapter that names no row *is* new — "add" mints the id before there is
  // any text — and it sits one past the end of the saved list.
  const openChapterId = activeJournalChapterId(chapters, activeChapterId);
  const chapterOnFile =
    openChapterId != null && chapters.some((c) => c.id === openChapterId);
  const chapterIsDraft = isJournal && !chapterOnFile;
  const chapterIndex = chapterIsDraft
    ? chapters.length
    : journalChapterIndex(chapters, openChapterId ?? undefined);
  const chapterTotal = chapters.length + (chapterIsDraft ? 1 : 0);

  // Getting text out of the editor — share, copy, which chapters, and the
  // colour that says whether what left is still what the journal says.
  const exporter = useNoteEditorExport({
    isJournal,
    chapters,
    activeChapterId: openChapterId,
    draft: persist.draft,
    draftRef: persist.draftRef,
    persistedBody: persist.persistedBody,
    chapterShareFingerprints,
    shareFingerprint,
    saving,
    dictationBusy,
    chrome,
    flush: persist.flushPendingPersist,
    onShare,
    copiedLabel: t('note.copied'),
    copyErrorTitle: t('note.couldNotCopyTitle'),
    copyErrorBody: t('note.couldNotCopyBody'),
  });

  const shareStatus = exporter.status;
  const showShare =
    canShowNoteShare({
      hasDraftText,
      dictationBusy,
      shareAvailable: chrome.shareAvailable && onShare != null,
      saving,
    }) || chrome.sharing;
  const shareStatusA11y =
    shareStatus === 'current'
      ? t('note.shareStatusCurrentA11y')
      : shareStatus === 'stale'
        ? t('note.shareStatusStaleA11y')
        : t('note.shareStatusNeverA11y');
  const shareTextColor = noteShareActionColor(shareStatus, {
    current: theme.colors.primary,
    stale: isCartoon
      ? theme.colors.secondary
      : theme.dark
        ? NOTE_SHARE_STALE_DARK
        : NOTE_SHARE_STALE_LIGHT,
    idle: theme.colors.onSurface,
  });

  const requestDismiss = () => {
    persist.flushPendingPersist();
    onDismiss();
  };

  const applyClearAll = () => {
    if (listening) dictation.cancel();
    persist.clearAll();
    clearDictationNotices();
  };

  const handleClear = () => {
    if (saving) return;
    if (listening && !hasDraftText && liveChars <= 0) return;
    if (!listening && !showClear) return;
    confirmClearNoteBody({ noun, listening, onConfirm: applyClearAll });
  };

  const handleSave = () => {
    if (saving) return;
    persist.flushPendingPersist();
    onSave(persist.draftRef.current);
  };

  const enterTextEditing = () => {
    if (saving || chrome.sharing || dictationBusy) return;
    persist.remountField(persist.draftRef.current);
    persist.setTextEditing(true);
  };

  const leaveTextEditing = () => {
    Keyboard.dismiss();
    if (!persist.textEditing) return;
    persist.remountField(persist.draftRef.current);
    persist.flushPendingPersist();
    persist.setTextEditing(false);
  };

  /** Hand the draft over as-is; the session writes it before loading the next chapter. */
  const leaveChapter = (go: (body: string) => void) => {
    if (listening) dictation.cancel();
    leaveTextEditing();
    go(persist.draftRef.current);
  };

  const handleDeleteChapter = () => {
    if (!onDeleteChapter || historyLocked) return;
    confirmDeleteChapter({
      number: chapterIndex + 1,
      onConfirm: () => {
        if (listening) dictation.cancel();
        onDeleteChapter();
      },
    });
  };

  return (
    <>
      <Portal>
        {visible && dictationBusy ? <DictationKeepAwake /> : null}
        <Modal
          visible={visible}
          onDismiss={requestDismiss}
          style={styles.modalWrap}
          contentContainerStyle={[
            styles.modal,
            {
              width: sheetWidth,
              maxHeight: windowHeight - insets.top - insets.bottom - 32,
              backgroundColor: theme.colors.surface,
              borderRadius: deco.radius.lg,
              ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
              ...(isCartoon && {
                borderWidth: deco.cardBorderWidth,
                borderColor: theme.colors.outline,
              }),
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <NoteEditorHeader
              heading={
                heading?.trim() ||
                trackerName.trim() ||
                (isJournal ? t('note.journalHeading') : t('note.noteHeading'))
              }
              subtitle={date ? formatFullDate(date) : ''}
              titleIcon={isJournal ? (headingIcon ?? 'notebook-outline') : headingIcon}
              isJournal={isJournal}
              noun={noun}
              showShare={showShare}
              shareColor={shareTextColor}
              shareStatusA11y={shareStatusA11y}
              sharing={chrome.sharing}
              onShare={() => exporter.request('share')}
              showMenu={showClear || hasDraftText}
              menuOpen={chrome.menuOpen}
              menuEpoch={chrome.menuEpoch}
              onMenuOpenChange={chrome.setMenuOpen}
              menuDisabled={saving || chrome.sharing}
              showClear={showClear}
              onClear={() => chrome.closeMenuThen(handleClear)}
              showCopy={hasDraftText && !listening}
              copyDisabled={saving}
              copyLabel={chrome.copyFeedback ?? t('note.copy')}
              onCopy={() => chrome.closeMenuThen(() => exporter.request('copy'))}
              onClose={requestDismiss}
            />

            {isJournal && onSelectChapter && onAddChapter && chapterTotal > 0 ? (
              <NoteEditorChapterBar
                chapters={chapters}
                activeId={openChapterId}
                index={chapterIndex}
                total={chapterTotal}
                isDraft={chapterIsDraft}
                locked={historyLocked}
                onSelect={(id) => leaveChapter((body) => onSelectChapter(id, body))}
                onAdd={() => leaveChapter((body) => onAddChapter(body))}
                onDelete={handleDeleteChapter}
              />
            ) : null}

            <NoteEditorDictationStatus
              englishOnly={i18n.language.toLowerCase().startsWith('fr')}
              status={dictation.status}
              error={dictation.error}
            />

            <NoteEditorBody
              textEditing={persist.textEditing}
              isJournal={isJournal}
              noun={noun}
              placeholder={
                isJournal
                  ? t('note.previewPlaceholderJournal')
                  : t('note.previewPlaceholderNote')
              }
              fieldKey={`${sessionKey ?? 'closed'}-${persist.fieldEpoch}`}
              fieldSeed={persist.fieldSeed}
              draft={persist.draft}
              live={dictation.live}
              listening={listening}
              capturing={dictation.capturing}
              dictationBusy={dictationBusy}
              reviewHighlight={
                !listening && !persist.textEditing
                  ? splitAddedTake(initialBody, persist.draft)
                  : null
              }
              minHeight={previewMinHeight}
              maxHeight={previewMaxHeight}
              saving={saving}
              onChangeText={(next) => {
                clearDictationNotices();
                persist.draftRef.current = next;
                persist.setDraft(next);
                persist.schedulePersist();
              }}
              onEdit={enterTextEditing}
            />

            {remaining <= NOTE_BODY_APPROACHING_REMAINING ? (
              <NoteEditorLimitNotice
                remaining={remaining}
                used={persist.draft.length + liveChars}
                noun={noun}
              />
            ) : null}

            {dictation.notice ? (
              <Text
                variant="bodySmall"
                accessibilityLiveRegion="polite"
                style={{
                  color:
                    dictation.notice.tone === 'error'
                      ? theme.colors.error
                      : theme.colors.onSurfaceVariant,
                  marginTop: space.xs,
                }}
              >
                {dictation.notice.text}
              </Text>
            ) : null}

            {chrome.copyFeedback ? (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary, marginTop: space.sm }}
              >
                {chrome.copyFeedback}
              </Text>
            ) : null}

            <NoteEditorActions
              leading={
                <NoteEditorHistoryBar
                  canUndo={persist.canUndo}
                  canRedo={persist.canRedo}
                  hidden={historyLocked}
                  onUndo={() => {
                    if (!historyLocked) persist.undoChunk();
                  }}
                  onRedo={() => {
                    if (!historyLocked) persist.redoChunk();
                  }}
                />
              }
              mic={
                <DictationMicButton
                  field={dictation}
                  disabled={dictation.micDisabled || chrome.sharing}
                  onPress={() => {
                    leaveTextEditing();
                    void dictation.start();
                  }}
                />
              }
              showDone={showDone}
              showSave={!showDone && hasDraftText}
              saving={saving}
              dictationStarting={dictation.starting}
              dictationFinishing={dictation.finishing}
              onDone={dictation.finish}
              onSave={handleSave}
            />
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
      {visible && isJournal ? (
        <NoteEditorChapterPicker
          mode={exporter.mode}
          chapters={exporter.views}
          selected={exporter.selected}
          statuses={exporter.statuses}
          onToggle={exporter.toggle}
          onSelectAll={exporter.selectAll}
          onSelectNone={exporter.selectNone}
          onConfirm={exporter.confirm}
          onCancel={exporter.cancel}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  modalWrap: {
    justifyContent: 'center',
  },
  modal: {
    alignSelf: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      default: {},
    }),
  },
  keyboardAvoid: {
    flexGrow: 0,
  },
});
