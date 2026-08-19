jest.mock('life-moonshine-dictation', () => {
  const progressListeners: ((event: { fraction: number }) => void)[] = [];
  return {
    __progressListeners: progressListeners,
    __emitProgress: (fraction: number) => {
      for (const listener of progressListeners) listener({ fraction });
    },
    prepareMoonshineDictation: jest.fn(async () => ({ ready: true })),
    warmMoonshineDictation: jest.fn(async () => undefined),
    deleteLegacySpeechModels: jest.fn(async () => undefined),
    addMoonshineDownloadProgressListener: jest.fn(
      (listener: (event: { fraction: number }) => void) => {
        progressListeners.push(listener);
        return { remove: jest.fn() };
      },
    ),
  };
});

type MockedDictationModule = {
  __progressListeners: ((event: { fraction: number }) => void)[];
  __emitProgress: (fraction: number) => void;
  prepareMoonshineDictation: jest.Mock;
  warmMoonshineDictation: jest.Mock;
  deleteLegacySpeechModels: jest.Mock;
  addMoonshineDownloadProgressListener: jest.Mock;
};

/** Module has closure-scoped singleton state (modelReady/legacyCleanupScheduled) — reset per test. */
function freshModule(): {
  mocked: MockedDictationModule;
  ensureMoonshineDictationReady: typeof import('../src/dictation/ensureMoonshineModel').ensureMoonshineDictationReady;
  preloadMoonshineDictation: typeof import('../src/dictation/ensureMoonshineModel').preloadMoonshineDictation;
} {
  jest.resetModules();
  const mocked = jest.requireMock('life-moonshine-dictation') as MockedDictationModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- fresh require after resetModules()
  const mod: typeof import('../src/dictation/ensureMoonshineModel') = require('../src/dictation/ensureMoonshineModel');
  return {
    mocked,
    ensureMoonshineDictationReady: mod.ensureMoonshineDictationReady,
    preloadMoonshineDictation: mod.preloadMoonshineDictation,
  };
}

describe('ensureMoonshineDictationReady', () => {
  it('reports checking then progress phases and resolves ready', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();
    mocked.prepareMoonshineDictation.mockImplementationOnce(async () => {
      mocked.__emitProgress(0.5);
      return { ready: true };
    });

    const statuses: string[] = [];
    const result = await ensureMoonshineDictationReady({
      onStatus: (s) => statuses.push(s.phase),
    });

    expect(result).toEqual({ ready: true, locale: expect.any(String) });
    expect(statuses).toEqual(['checking', 'progress']);
  });

  it('deletes legacy models exactly once even across repeated calls', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();

    await ensureMoonshineDictationReady();
    await ensureMoonshineDictationReady();
    await ensureMoonshineDictationReady();

    expect(mocked.deleteLegacySpeechModels).toHaveBeenCalledTimes(1);
  });

  it('short-circuits without calling prepare again once the model is ready', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();

    await ensureMoonshineDictationReady();
    expect(mocked.prepareMoonshineDictation).toHaveBeenCalledTimes(1);

    await ensureMoonshineDictationReady();
    expect(mocked.prepareMoonshineDictation).toHaveBeenCalledTimes(1);
  });

  it('always detaches the progress listener, even when prepare fails', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();
    mocked.prepareMoonshineDictation.mockRejectedValueOnce(new Error('disk full'));

    const result = await ensureMoonshineDictationReady();

    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.message).toContain('disk full');
    }
    const [subscription] = mocked.addMoonshineDownloadProgressListener.mock.results.map(
      (r) => r.value,
    );
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('returns an aborted result and never calls prepare when the signal is already aborted', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();
    const controller = new AbortController();
    controller.abort();

    const result = await ensureMoonshineDictationReady({ signal: controller.signal });

    expect(result).toEqual({ ready: false, message: '', aborted: true });
    expect(mocked.prepareMoonshineDictation).not.toHaveBeenCalled();
  });

  it('truncates a long error message to 120 chars in the failure result', async () => {
    const { mocked, ensureMoonshineDictationReady } = freshModule();
    mocked.prepareMoonshineDictation.mockRejectedValueOnce(new Error('x'.repeat(200)));

    const result = await ensureMoonshineDictationReady();

    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.message.length).toBeLessThan(200);
    }
  });
});

describe('preloadMoonshineDictation', () => {
  it('warms the model', async () => {
    const { mocked, preloadMoonshineDictation } = freshModule();
    await preloadMoonshineDictation();
    expect(mocked.warmMoonshineDictation).toHaveBeenCalledTimes(1);
  });

  it('does not warm when the signal is already aborted', async () => {
    const { mocked, preloadMoonshineDictation } = freshModule();
    const controller = new AbortController();
    controller.abort();

    await preloadMoonshineDictation(controller.signal);

    expect(mocked.warmMoonshineDictation).not.toHaveBeenCalled();
  });

  it('swallows warm() failures — preload is best-effort', async () => {
    const { mocked, preloadMoonshineDictation } = freshModule();
    mocked.warmMoonshineDictation.mockRejectedValueOnce(new Error('boom'));

    await expect(preloadMoonshineDictation()).resolves.toBeUndefined();
  });
});
