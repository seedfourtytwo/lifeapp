import React from 'react';
import NoteEditorSheet from './NoteEditorSheet';
import type { NoteEditorSession } from './useNoteEditorSession';

type Props = {
  session: NoteEditorSession;
};

/** One sheet for tracker notes and the daily journal. */
export default function NoteEditorHost({ session }: Props) {
  const {
    sheet,
    dismiss,
    persist,
    save,
    share,
    saving,
    selectChapter,
    addChapter,
    removeChapter,
  } = session;
  return (
    <NoteEditorSheet
      visible={sheet.visible}
      date={sheet.date}
      sessionKey={sheet.sessionKey}
      heading={sheet.heading}
      kind={sheet.kind}
      headingIcon={sheet.headingIcon}
      trackerName={sheet.trackerName}
      initialBody={sheet.initialBody}
      shareFingerprint={sheet.shareFingerprint}
      chapterShareFingerprints={sheet.chapterShareFingerprints}
      autoStartDictation={sheet.autoStartDictation}
      chapters={sheet.chapters}
      activeChapterId={sheet.activeChapterId}
      saving={saving}
      onDismiss={dismiss}
      onPersist={(body) => void persist(body)}
      onSave={(body) => void save(body)}
      onShare={(body, chapterIds) => void share(body, chapterIds)}
      onSelectChapter={(id, body) => void selectChapter(id, body)}
      onAddChapter={(body) => void addChapter(body)}
      onDeleteChapter={() => void removeChapter()}
    />
  );
}
