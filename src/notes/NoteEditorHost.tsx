import React from 'react';
import NoteEditorSheet from './NoteEditorSheet';
import type { NoteEditorSession } from './useNoteEditorSession';

type Props = {
  session: NoteEditorSession;
};

/** One sheet for tracker notes and the daily journal. */
export default function NoteEditorHost({ session }: Props) {
  const { sheet, dismiss, persist, save, share, saving } = session;
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
      autoStartDictation={sheet.autoStartDictation}
      saving={saving}
      onDismiss={dismiss}
      onPersist={(body) => void persist(body)}
      onSave={(body) => void save(body)}
      onShare={(body) => void share(body)}
    />
  );
}
