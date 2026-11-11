import { Platform } from 'react-native';
import { loadLifeCoreModule, type LifeCoreNativeModule } from 'life-core';
import {
  CoreTimerStateSchema,
  TimerSessionRecordSchema,
  type CoreTimerState,
} from '../protocol/coreTimer';
import { createFakeLifeCore } from './fakeLifeCore';
import type { LifeCore } from './lifeCoreTypes';

export type { LifeCore, LifeCoreSubscription } from './lifeCoreTypes';

function parseState(json: string | null): CoreTimerState | null {
  return json === null ? null : CoreTimerStateSchema.parse(JSON.parse(json));
}

/** The module's JSON, checked at the bridge like every other edge. */
export function nativeLifeCore(module: LifeCoreNativeModule): LifeCore {
  return {
    start: async (request) => {
      const state = parseState(await module.start(JSON.stringify(request)));
      if (!state) throw new Error('The native core started no session');
      return state;
    },
    pause: async () => parseState(await module.pause()),
    resume: async () => parseState(await module.resume()),
    finish: async ({ markComplete }) => {
      const json = await module.finish(markComplete);
      return json === null ? null : TimerSessionRecordSchema.parse(JSON.parse(json));
    },
    discard: () => module.discard(),
    getState: async () => parseState(await module.getState()),
    addStateListener: (listener) =>
      module.addListener('onStateChange', ({ state }) => listener(parseState(state))),
    previewSound: (trackId) => module.previewSound(trackId),
    stopPreview: () => module.stopPreview(),
  };
}

const nativeModule = Platform.OS === 'android' ? loadLifeCoreModule() : null;

/** The native core on Android; elsewhere the fake with the same behaviour. */
export const lifeCore: LifeCore = nativeModule ? nativeLifeCore(nativeModule) : createFakeLifeCore();
