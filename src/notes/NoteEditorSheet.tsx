import React from 'react';
import { Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useKeyboardHeight } from '../hooks/useDialogKeyboardLift';
import { sheetBottomPadding } from '../components/sheet/sheetGesture';
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
/** Widest the sheet grows on a tablet or a phone on its side — the editor sheet's limit. */
const SHEET_MAX_WIDTH = 640;
const GRABBER = { width: 36, height: 4 };

function DictationKeepAwake() {
  useKeepAwake(DICTATION_WAKE_TAG);
  return null;
}

/**
 * Shared editor for tracker notes and the daily journal.
 * Mic-first preview; tap the body to type. Header X dismisses.
 * Done stops the mic; Save writes and closes when there is draft text. A quick
 * dictation — opened by a mic glyph — is filed by Done itself.
 *
 * The sheet lives in a portal above the navigation stack, so it closes itself
 * when its screen loses focus rather than staying drawn over the next one.
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
  const { decorations: deco } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight(visible);
  const focused = useIsFocused();
  const previewMaxHeight = Math.round(Math.min(windowHeight * 0.52, windowHeight - 320));
  const previewMinHeight = Math.round(Math.min(windowHeight * 0.28, previewMaxHeight));

  const persist = useNoteEditorPersist({
    visible,
    date,
    sessionKey,
    initialBody,
    onPersist,
  });

  // Set by Done, read when the take has been committed: Done files a quick
  // dictation, while a take that ended on its own leaves the sheet open.
  const doneRequestedRef = React.useRef(false);

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
      const done = doneRequestedRef.current;
      doneRequestedRef.current = false;
      if (!autoStartDictation || saving) return;
      if (!persist.draftRef.current.trim()) {
        // Opened by a tracker's mic button and nothing was said: get out of the way.
        onDismiss();
      } else if (done) {
        handleSave();
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
    stale: theme.dark ? NOTE_SHARE_STALE_DARK : NOTE_SHARE_STALE_LIGHT,
    idle: theme.colors.onSurface,
  });

  const requestDismiss = () => {
    persist.flushPendingPersist();
    onDismiss();
  };

  const requestDismissRef = React.useRef(requestDismiss);
  requestDismissRef.current = requestDismiss;
  React.useEffect(() => {
    if (visible && !focused) requestDismissRef.current();
  }, [visible, focused]);

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
          // The same scrim every sheet dims the screen with.
          theme={{ colors: { backdrop: deco.scrim } }}
          style={styles.modalWrap}
          contentContainerStyle={[
            styles.sheet,
            deco.sheetShadow,
            {
              maxHeight: windowHeight - insets.top - space.xl,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: deco.radius.xl,
              borderTopRightRadius: deco.radius.xl,
              // Android draws edge to edge, so the window does not shrink for the
              // keyboard: the sheet pads itself over it, like the editor sheet.
              paddingBottom: sheetBottomPadding({ keyboardHeight, safeBottom: insets.bottom }),
            },
          ]}
        >
          <View
            testID="note-sheet-grabber"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.grabber,
              { backgroundColor: theme.colors.outlineVariant, borderRadius: deco.radius.pill },
            ]}
          />
          <View style={styles.body}>
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
              onDone={() => {
                doneRequestedRef.current = true;
                dictation.finish();
              }}
              onSave={handleSave}
            />
          </View>
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
    justifyContent: 'flex-end',
    // Paper keeps a modal clear of the navigation bar; a sheet sits on the edge
    // and pads that inset itself, so it reads as part of the bottom of the phone.
    marginBottom: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: 10,
  },
  grabber: {
    ...GRABBER,
    alignSelf: 'center',
    marginBottom: space.lg,
  },
  body: {
    flexGrow: 0,
  },
});
