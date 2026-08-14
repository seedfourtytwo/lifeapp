import React from 'react';
import NoteEditorSheet from './NoteEditorSheet';
import type { NoteEditorSession } from './useNoteEditorSession';

type Props = {
  session: NoteEditorSession;
};

/** One sheet for tracker notes and the daily journal. */
export default function NoteEditorHost({ session }: Props) {
  const { sheet, dismiss, save, saving } = session;
  return (
    <NoteEditorSheet
      visible={sheet.visible}
      date={sheet.date}
      sessionKey={sheet.sessionKey}
      heading={sheet.heading}
      kind={sheet.kind}
      trackerName={sheet.trackerName}
      initialBody={sheet.initialBody}
      autoStartDictation={sheet.autoStartDictation}
      saving={saving}
      onDismiss={dismiss}
      onSave={(body) => void save(body)}
    />
  );
}
