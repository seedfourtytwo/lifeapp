import React from 'react';
import DayNoteEditorSheet from '../components/DayNoteEditorSheet';
import type { NoteEditorSession } from './useNoteEditorSession';

type Props = {
  session: NoteEditorSession;
};

/** Renders the shared note/journal sheet from a useNoteEditorSession instance. */
export default function NoteEditorHost({ session }: Props) {
  const { sheet, dismiss, save, saving } = session;
  return (
    <DayNoteEditorSheet
      visible={sheet.visible}
      date={sheet.date}
      sessionKey={sheet.sessionKey}
      heading={sheet.heading}
      trackerName={sheet.trackerName}
      initialBody={sheet.initialBody}
      autoStartDictation={sheet.autoStartDictation}
      saving={saving}
      onDismiss={dismiss}
      onSave={(body) => void save(body)}
    />
  );
}
