/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * A todo write that fails (disk full, a locked database) must tell the user.
 * The Todos tab fired its writes and dropped the promise, so a failed add,
 * tick, Undo or delete was an unhandled rejection and the screen said nothing
 * — the typed title was already cleared and the tick looked taken.
 *
 * Real todo store, real SQLite; triggers make every write to `todos` fail
 * while reads still work.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import '../src/i18n';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../src/dictation/useDictationField', () => ({
  useDictationField: () => ({
    supported: false,
    listening: false,
    capturing: false,
    starting: false,
    finishing: false,
    sessionOpen: false,
    busy: false,
    live: null,
    liveChars: 0,
    notice: null,
    error: null,
    status: null,
    micDisabled: true,
    start: jest.fn(),
    finish: jest.fn(),
    cancel: jest.fn(),
    clearNotices: jest.fn(),
    reset: jest.fn(),
  }),
}));

import { getDatabase } from '../src/db/client';
import * as todoRepo from '../src/db/repositories/todoRepository';
import TodosScreen from '../src/screens/TodosScreen';
import TodoQuickAdd from '../src/screens/todos/TodoQuickAdd';
import TodoRow from '../src/screens/todos/TodoRow';
import TodoEditorSheet from '../src/screens/todos/TodoEditorSheet';
import { UndoSnackbar } from '../src/components/UndoSnackbar';
import type { Todo } from '../src/protocol';

let testDb: TestDb;
let tree: ReactTestRenderer;
let seeded: Todo;
const unhandled = jest.fn();
let alertSpy: jest.SpyInstance;

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });
}

/** The props the screen handed to one of its children — the seam the user's taps go through. */
function propsOf<C extends React.ElementType>(type: C): React.ComponentProps<C> {
  return tree.root.findByType(type).props as React.ComponentProps<C>;
}

function failTodoWrites(): void {
  for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
    testDb.raw.exec(
      `CREATE TRIGGER fail_todo_${op.toLowerCase()} BEFORE ${op} ON todos
       BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END;`,
    );
  }
}

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  seeded = await todoRepo.createTodo(testDb.db, { title: 'Renew passport' });
  unhandled.mockClear();
  process.on('unhandledRejection', unhandled);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

  await act(async () => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 0, left: 0, right: 0, bottom: 0 },
          },
        },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(NavigationContainer, null, React.createElement(TodosScreen)),
        ),
      ),
    );
  });
  await flush();
  failTodoWrites();
});

afterEach(() => {
  act(() => tree.unmount());
  process.off('unhandledRejection', unhandled);
  alertSpy.mockRestore();
  testDb.raw.close();
});

it('says so when adding a todo fails', async () => {
  act(() => propsOf(TodoQuickAdd).onChangeText('Buy milk'));
  act(() => propsOf(TodoQuickAdd).onSubmit());
  await flush();

  expect(unhandled).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalled();
});

it('says so when ticking a todo fails', async () => {
  act(() => propsOf(TodoRow).onToggle(seeded));
  await flush();

  expect(unhandled).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalled();
});

it('says so when the Undo of a tick fails', async () => {
  act(() => propsOf(TodoRow).onToggle(seeded));
  await flush();
  alertSpy.mockClear();

  act(() => propsOf(UndoSnackbar).onUndo());
  await flush();

  expect(unhandled).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalled();
});

it('says so when a delete fails once its Undo runs out', async () => {
  act(() => propsOf(TodoEditorSheet).onDelete?.(seeded));
  act(() => propsOf(UndoSnackbar).onDismiss());
  await flush();

  expect(unhandled).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalled();
});
