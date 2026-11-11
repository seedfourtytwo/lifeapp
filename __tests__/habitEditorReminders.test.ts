/**
 * The habit editor's Reminders row: times shown, added, removed, and saved,
 * for check-off and timer habits alike.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import HabitEditorFields from '../src/components/trackerEditor/HabitEditorFields';
import {
  editorSessionFromHabit,
  newEditorSession,
} from '../src/components/trackerEditor/trackerEditorSession';
import type {
  HabitEditorFieldState,
  TrackerEditorSaveData,
} from '../src/components/trackerEditor/types';
import { HabitConfigSchema } from '../src/protocol';
import { appLightTheme } from '../src/theme/themes';
import { parseTrackerEditorSave } from '../src/utils/parseTrackerEditorSave';

function fieldState(overrides: Partial<HabitEditorFieldState> = {}): HabitEditorFieldState {
  const { sessionId: _s, mode: _m, editingId: _e, name: _n, icon: _i, increments: _inc, dailyTarget: _d, ...rest } =
    newEditorSession({ mode: 'habit' });
  return { ...rest, ...overrides };
}

function mount(state: HabitEditorFieldState, onChange = jest.fn()) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(PaperProvider, {
        theme: appLightTheme,
        children: React.createElement(HabitEditorFields, { state, onChange }),
      }),
    );
  });
  return { renderer, onChange };
}

function openReminders(renderer: ReactTestRenderer): void {
  const row = renderer.root.find(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.findAll((c) => c.props.children === 'Reminders').length > 0,
  );
  act(() => (row.props.onPress as () => void)());
}

function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string);
}

function pressByLabel(renderer: ReactTestRenderer, label: string): void {
  const [target] = renderer.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  );
  if (!target) throw new Error(`Nothing labelled ${label}`);
  act(() => (target.props.onPress as () => void)());
}

describe.each(['boolean', 'timer'] as const)('Reminders row on a %s habit', (habitTrackingMode) => {
  it('says which times are set while closed', () => {
    const { renderer } = mount(fieldState({ habitTrackingMode, reminderTimes: ['08:00', '20:00'] }));

    expect(texts(renderer)).toContain('08:00, 20:00');
  });

  it('says Off with no times', () => {
    const { renderer } = mount(fieldState({ habitTrackingMode }));

    expect(texts(renderer)).toContain('Off');
  });

  it('removes a time', () => {
    const { renderer, onChange } = mount(
      fieldState({ habitTrackingMode, reminderTimes: ['08:00', '20:00'] }),
    );
    openReminders(renderer);

    pressByLabel(renderer, 'Remove the 08:00 reminder');

    expect(onChange).toHaveBeenCalledWith({ reminderTimes: ['20:00'] });
  });

  it('adds a typed time in its place in the day and clears the field', () => {
    const { renderer, onChange } = mount(
      fieldState({ habitTrackingMode, reminderTimes: ['20:00'], reminderTimeDraft: '7:30' }),
    );
    openReminders(renderer);

    pressByLabel(renderer, 'Add reminder time');

    expect(onChange).toHaveBeenCalledWith({ reminderTimes: ['07:30', '20:00'], reminderTimeDraft: '' });
  });

  it('refuses a time that is not a time, and says so', () => {
    const { renderer, onChange } = mount(fieldState({ habitTrackingMode, reminderTimeDraft: '25:00' }));
    openReminders(renderer);

    pressByLabel(renderer, 'Add reminder time');

    expect(onChange).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain('Enter a time like 08:00');
  });
});

describe('saving reminder times', () => {
  const save = (overrides: Partial<HabitEditorFieldState>): TrackerEditorSaveData => ({
    mode: 'habit',
    name: 'Burp the kefir',
    icon: null,
    ...fieldState(overrides),
  });

  it('saves the listed times', () => {
    const result = parseTrackerEditorSave(save({ reminderTimes: ['09:00', '21:00'] }));

    expect(result.kind === 'habit' && result.input.reminderTimes).toEqual(['09:00', '21:00']);
  });

  it('keeps a time typed but not yet added', () => {
    const result = parseTrackerEditorSave(
      save({ reminderTimes: ['21:00'], reminderTimeDraft: '0900' }),
    );

    expect(result.kind === 'habit' && result.input.reminderTimes).toEqual(['09:00', '21:00']);
  });

  it('refuses to save a typed time that is not a time', () => {
    expect(() => parseTrackerEditorSave(save({ reminderTimeDraft: 'soon' }))).toThrow(
      'Enter a time like 08:00',
    );
  });

  it('opens an existing habit with its times and an empty field', () => {
    const session = editorSessionFromHabit(
      'h1',
      'Rinse the sprouts',
      HabitConfigSchema.parse({ reminderTimes: ['20:00', '08:00'] }),
    );

    expect(session.reminderTimes).toEqual(['08:00', '20:00']);
    expect(session.reminderTimeDraft).toBe('');
  });
});
