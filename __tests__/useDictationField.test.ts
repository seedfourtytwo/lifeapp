/**
 * The glue that used to live inside the note editor.
 *
 * `useDictationField` is the whole "dictate into this text field" unit: it
 * owns the controller, the character budget, the one-line notice and the
 * mic's enabled/disabled state, so a screen supplies a value, a setter and a
 * cap and nothing else. The engine and the note editor are both absent here —
 * that absence is the point of the extraction.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import '../src/i18n';
import type { DictationLivePreview } from '../src/dictation/livePreview';

type ControllerProps = {
  disabled?: boolean;
  active?: boolean;
  autoStart?: boolean;
  autoStartToken?: string | null;
  noteRoomChars?: number;
  onTranscript: (text: string) => void;
  onLive?: (live: DictationLivePreview | null) => void;
  onSessionChange?: (open: boolean) => void;
  onFinished?: () => void;
  onError?: (message: string | null) => void;
  onStatus?: (status: { phase: string; message: string; progress?: number } | null) => void;
  onTakeWarning?: () => void;
  onTakeLimit?: (reason: 'characters' | 'duration') => void;
};

/** Last props the hook handed the controller, plus its stubbed answers. */
const mockController = {
  props: null as ControllerProps | null,
  supported: true,
  listening: false,
  capturing: false,
  starting: false,
  finishing: false,
  sessionOpen: false,
  start: jest.fn(async () => undefined),
  finish: jest.fn(),
  cancel: jest.fn(),
};

jest.mock('../src/dictation/useNoteDictationController', () => ({
  useNoteDictationController: (props: ControllerProps) => {
    mockController.props = props;
    return {
      listening: mockController.listening,
      capturing: mockController.capturing,
      starting: mockController.starting,
      finishing: mockController.finishing,
      sessionOpen: mockController.sessionOpen,
      start: mockController.start,
      finish: mockController.finish,
      cancel: mockController.cancel,
      supported: mockController.supported,
    };
  },
}));

const mockCommitHaptic = jest.fn(async () => undefined);
jest.mock('../src/utils/habitHaptics', () => ({
  playDictationCommitHaptic: () => mockCommitHaptic(),
}));

const keyboardDismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { useDictationField } =
  require('../src/dictation/useDictationField') as typeof import('../src/dictation/useDictationField');
type DictationField = ReturnType<typeof useDictationField>;
type Options = Parameters<typeof useDictationField>[0];
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

/**
 * Mount the hook over a piece of text the harness owns, so `onChangeText`
 * feeds the next render the way a real screen's state would.
 */
function mountField(options: Omit<Options, 'value' | 'onChangeText'> & { initial?: string }) {
  const { initial = '', ...rest } = options;
  let field!: DictationField;
  let text = initial;
  const changes: string[] = [];

  const Harness = () => {
    const [value, setValue] = React.useState(initial);
    text = value;
    field = useDictationField({
      ...rest,
      value,
      onChangeText: (next) => {
        changes.push(next);
        setValue(next);
      },
    } as Options);
    return null;
  };

  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(React.createElement(Harness));
  });

  return {
    get field() {
      return field;
    },
    get text() {
      return text;
    },
    changes,
    /** Re-render with the controller's stubbed state changed. */
    setController(next: Partial<typeof mockController>) {
      Object.assign(mockController, next);
      act(() => {
        tree.update(React.createElement(Harness));
      });
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockController, {
    props: null,
    supported: true,
    listening: false,
    capturing: false,
    starting: false,
    finishing: false,
    sessionOpen: false,
  });
});

describe('useDictationField', () => {
  it('reports whether this build can dictate at all', () => {
    const mounted = mountField({ maxLength: 120 });
    expect(mounted.field.supported).toBe(true);
    mounted.unmount();

    mockController.supported = false;
    const unsupported = mountField({ maxLength: 120 });
    expect(unsupported.field.supported).toBe(false);
    unsupported.unmount();
  });

  it('appends a committed take to the field and buzzes once', () => {
    const mounted = mountField({ maxLength: 120, join: 'inline', initial: 'buy milk' });
    act(() => {
      mockController.props!.onTranscript('and bread');
    });
    expect(mounted.changes).toEqual(['buy milk and bread']);
    expect(mockCommitHaptic).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });

  it('tells the controller how much room is left, so a take stops in time', () => {
    const mounted = mountField({ maxLength: 20, join: 'inline', initial: '12345' });
    expect(mockController.props!.noteRoomChars).toBe(15);
    mounted.unmount();
  });

  it('shows the caller its own copy when a take had to be cut', () => {
    const mounted = mountField({
      maxLength: 10,
      join: 'inline',
      initial: '',
      truncatedNotice: 'that was too long',
    });
    act(() => {
      mockController.props!.onTranscript('alpha bravo charlie');
    });
    expect(mounted.field.notice).toEqual({ text: 'that was too long', tone: 'error' });
    mounted.unmount();
  });

  it('keeps the take-limit line through the commit it triggered', () => {
    const mounted = mountField({ maxLength: 500, join: 'inline' });
    act(() => {
      mockController.props!.onTakeLimit?.('duration');
    });
    const limitNotice = mounted.field.notice;
    expect(limitNotice?.tone).toBe('notice');
    expect(limitNotice?.text).toBeTruthy();

    act(() => {
      mockController.props!.onTranscript('some words');
    });
    expect(mounted.field.notice).toEqual(limitNotice);
    mounted.unmount();
  });

  it('drops the take warning once the take lands', () => {
    const mounted = mountField({ maxLength: 500, join: 'inline' });
    act(() => {
      mockController.props!.onTakeWarning?.();
    });
    expect(mounted.field.notice?.tone).toBe('notice');
    act(() => {
      mockController.props!.onTranscript('some words');
    });
    expect(mounted.field.notice).toBeNull();
    mounted.unmount();
  });

  it('puts the keyboard away when the mic opens, and clears the live tail when it closes', () => {
    const seen: boolean[] = [];
    const mounted = mountField({
      maxLength: 500,
      onSessionChange: (open) => seen.push(open),
    });

    act(() => {
      mockController.props!.onSessionChange?.(true);
      mockController.props!.onLive?.({ committed: 'hello', tail: 'the' });
    });
    expect(keyboardDismiss).toHaveBeenCalled();
    expect(mounted.field.live).toEqual({ committed: 'hello', tail: 'the' });

    act(() => {
      mockController.props!.onSessionChange?.(false);
    });
    expect(mounted.field.live).toBeNull();
    expect(seen).toEqual([true, false]);
    mounted.unmount();
  });

  it('counts the live take against the budget only while the mic is open', () => {
    const mounted = mountField({ maxLength: 500, initial: '12345' });
    act(() => {
      mockController.props!.onLive?.({ committed: 'hello', tail: '' });
    });
    // Nothing is open, so a stale preview must not eat into the budget.
    expect(mounted.field.liveChars).toBe(0);

    mounted.setController({ sessionOpen: true });
    expect(mounted.field.liveChars).toBe(5);
    mounted.unmount();
  });

  it('surfaces prep progress and errors, and an error retires the progress line', () => {
    const mounted = mountField({ maxLength: 500 });
    act(() => {
      mockController.props!.onStatus?.({ phase: 'progress', message: 'Downloading…', progress: 40 });
    });
    expect(mounted.field.status).toEqual({ message: 'Downloading…', progress: 40 });

    act(() => {
      mockController.props!.onError?.('no microphone permission');
    });
    expect(mounted.field.error).toBe('no microphone permission');
    expect(mounted.field.status).toBeNull();
    mounted.unmount();
  });

  it('blocks the mic when the field is full, but not mid-take', () => {
    const full = mountField({ maxLength: 5, join: 'inline', initial: '12345' });
    expect(full.field.micDisabled).toBe(true);

    full.setController({ sessionOpen: true });
    // Mid-take the mic is how you finish, so it must stay live.
    expect(full.field.micDisabled).toBe(false);
    full.unmount();
  });

  it('blocks the mic while the surface is busy or hidden', () => {
    const busy = mountField({ maxLength: 500, disabled: true });
    expect(busy.field.micDisabled).toBe(true);
    busy.unmount();

    const hidden = mountField({ maxLength: 500, active: false });
    expect(hidden.field.micDisabled).toBe(true);
    hidden.unmount();
  });

  it('leaves the mic open for an auto-start even when the field is already full', () => {
    const mounted = mountField({
      maxLength: 5,
      join: 'inline',
      initial: '12345',
      autoStart: true,
      autoStartToken: 'note-1:dictate',
    });
    expect(mounted.field.micDisabled).toBe(false);
    mounted.unmount();
  });

  it('clears everything it is showing on request', () => {
    const mounted = mountField({ maxLength: 500 });
    act(() => {
      mockController.props!.onTakeWarning?.();
      mockController.props!.onError?.('boom');
      mockController.props!.onLive?.({ committed: 'hi', tail: '' });
    });
    act(() => {
      mounted.field.reset();
    });
    expect(mounted.field.notice).toBeNull();
    expect(mounted.field.error).toBeNull();
    expect(mounted.field.status).toBeNull();
    expect(mounted.field.live).toBeNull();
    mounted.unmount();
  });

  it('passes start, finish and cancel straight through', () => {
    const mounted = mountField({ maxLength: 500 });
    act(() => {
      mounted.field.start();
      mounted.field.finish();
      mounted.field.cancel();
    });
    expect(mockController.start).toHaveBeenCalledTimes(1);
    expect(mockController.finish).toHaveBeenCalledTimes(1);
    expect(mockController.cancel).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });
});
