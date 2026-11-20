import React from 'react';
import { useTodayNotebooks } from '../hooks/useTodayNotebooks';
import { NoteEditorHost } from '../notes';
import NutritionScreen from './NutritionScreen';

/**
 * The Food screen as a pushed route. It is opened from More, over Home, so it
 * cannot borrow Home's notebooks or journal sheet: it loads today's notebooks
 * itself and hosts its own sheet for the food journal.
 */
export default function NutritionRoute() {
  const today = useTodayNotebooks();

  return (
    <>
      <NutritionScreen
        notebooks={today.notebooks}
        onDictateNotebook={today.dictateNotebook}
        onEditNotebook={today.editNotebook}
        onNotebooksChanged={today.reloadNotebooks}
      />
      <NoteEditorHost session={today.noteEditor} />
    </>
  );
}
