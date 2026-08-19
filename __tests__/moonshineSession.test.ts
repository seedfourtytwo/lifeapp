import { openMoonshineDictationSession } from '../src/dictation/moonshineSession';

type Listener = (payload?: unknown) => void;

jest.mock('life-moonshine-dictation', () => {
  const listeners: Record<string, Listener[]> = {};

  function makeAddListener(event: string) {
    return jest.fn((listener: Listener) => {
      (listeners[event] ??= []).push(listener);
      return {
        remove: jest.fn(() => {
          listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
        }),
      };
    });
  }

  return {
    __listeners: listeners,
    __emit: (event: string, payload?: unknown) => {
      for (const listener of listeners[event] ?? []) listener(payload);
    },
    startMoonshineDictation: jest.fn(async () => undefined),
    stopMoonshineDictation: jest.fn(async () => ({ text: '  hello world  ' })),
    abortMoonshineDictation: jest.fn(async () => undefined),
    addMoonshineListeningListener: makeAddListener('onListening'),
    addMoonshinePartialListener: makeAddListener('onPartial'),
    addMoonshineCapturingListener: makeAddListener('onCapturing'),
    addMoonshineTakeLimitListener: makeAddListener('onTakeLimit'),
    addMoonshineErrorListener: makeAddListener('onError'),
  };
});

const mocked = jest.requireMock('life-moonshine-dictation') as {
  __listeners: Record<string, Listener[]>;
  __emit: (event: string, payload?: unknown) => void;
  startMoonshineDictation: jest.Mock;
  stopMoonshineDictation: jest.Mock;
  abortMoonshineDictation: jest.Mock;
};

describe('openMoonshineDictationSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mocked.__listeners)) delete mocked.__listeners[key];
    mocked.stopMoonshineDictation.mockResolvedValue({ text: '  hello world  ' });
  });

  it('wires every listener before activate() is called', () => {
    openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay: jest.fn(),
      onError: jest.fn(),
    });

    expect(mocked.__listeners.onListening).toHaveLength(1);
    expect(mocked.__listeners.onPartial).toHaveLength(1);
    expect(mocked.__listeners.onCapturing).toHaveLength(1);
    expect(mocked.__listeners.onTakeLimit).toHaveLength(1);
    expect(mocked.__listeners.onError).toHaveLength(1);
    expect(mocked.startMoonshineDictation).not.toHaveBeenCalled();
  });

  it('forwards trimmed partial text and capturing/take-limit events to handlers', () => {
    const onDisplay = jest.fn();
    const onCapturing = jest.fn();
    const onTakeLimit = jest.fn();
    openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay,
      onCapturing,
      onTakeLimit,
      onError: jest.fn(),
    });

    mocked.__emit('onPartial', { committed: '  Buy milk ', tail: ' and eggs ' });
    expect(onDisplay).toHaveBeenCalledWith({ committed: 'Buy milk', tail: 'and eggs' });

    mocked.__emit('onCapturing', { capturing: true });
    expect(onCapturing).toHaveBeenCalledWith(true);

    mocked.__emit('onTakeLimit', { reason: 'duration' });
    expect(onTakeLimit).toHaveBeenCalledWith('duration');
  });

  it('activate() starts the native mic', async () => {
    const { activate } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay: jest.fn(),
      onError: jest.fn(),
    });

    await activate();
    expect(mocked.startMoonshineDictation).toHaveBeenCalledTimes(1);
  });

  it('activate() detaches listeners and rethrows if the native start fails', async () => {
    mocked.startMoonshineDictation.mockRejectedValueOnce(new Error('mic busy'));
    const { activate } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay: jest.fn(),
      onError: jest.fn(),
    });

    await expect(activate()).rejects.toThrow('mic busy');
    // A late partial event after a failed start must not reach the caller.
    const onDisplay = jest.fn();
    mocked.__emit('onPartial', { committed: 'late', tail: '' });
    expect(onDisplay).not.toHaveBeenCalled();
  });

  it('stop() detaches listeners, clears the display, and returns trimmed text', async () => {
    const onDisplay = jest.fn();
    const { session } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay,
      onError: jest.fn(),
    });

    const text = await session.stop();

    expect(mocked.stopMoonshineDictation).toHaveBeenCalledTimes(1);
    expect(text).toBe('hello world');
    expect(onDisplay).toHaveBeenLastCalledWith(null);

    // Listeners already detached — a stray native event after stop is ignored.
    mocked.__emit('onPartial', { committed: 'ignored', tail: '' });
    expect(onDisplay).toHaveBeenCalledTimes(1);
  });

  it('stop() is idempotent — calling it twice only stops the native mic once', async () => {
    const { session } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay: jest.fn(),
      onError: jest.fn(),
    });

    await session.stop();
    const second = await session.stop();

    expect(mocked.stopMoonshineDictation).toHaveBeenCalledTimes(1);
    expect(second).toBe('');
  });

  it('abort() detaches listeners, clears the display, and does not resolve stop text', async () => {
    const onDisplay = jest.fn();
    const { session } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay,
      onError: jest.fn(),
    });

    await session.abort();

    expect(mocked.abortMoonshineDictation).toHaveBeenCalledTimes(1);
    expect(mocked.stopMoonshineDictation).not.toHaveBeenCalled();
    expect(onDisplay).toHaveBeenLastCalledWith(null);
  });

  it('abort() after stop() is a no-op', async () => {
    const { session } = openMoonshineDictationSession({
      onListening: jest.fn(),
      onDisplay: jest.fn(),
      onError: jest.fn(),
    });

    await session.stop();
    await session.abort();

    expect(mocked.abortMoonshineDictation).not.toHaveBeenCalled();
  });
});
