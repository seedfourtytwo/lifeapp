/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- loaded after the caller's resetModules() */
import type { ElementDefinition } from '../../src/protocol';

/**
 * The habit timer as the app drives it, against the fake native core that
 * Jest gets in place of the module: the card's controls, and the plain stop
 * (a session ended without Done) the controls use when another habit starts.
 */
export function timerKit(elements: readonly ElementDefinition[]) {
  const controls = require('../../src/habitTimer/habitTimerControls') as typeof import('../../src/habitTimer/habitTimerControls');
  const { useEventStore } = require('../../src/store/eventStore') as typeof import('../../src/store/eventStore');
  const { useElementStore } = require('../../src/store/elementStore') as typeof import('../../src/store/elementStore');
  const { applyFinishedTimerSession } = require('../../src/widget/pendingWidgetActions') as typeof import('../../src/widget/pendingWidgetActions');
  const { lifeCore } = require('../../src/core/lifeCore') as typeof import('../../src/core/lifeCore');
  useElementStore.setState({ elements: [...elements] });

  return {
    controls,
    core: lifeCore,
    /** Play on the card: starts, resumes, or pauses. */
    press: (elementId: string) => controls.pressHabitTimer(elementId),
    /** End the session without Done and log it, as when another habit starts. */
    stop: async () => {
      const record = await useEventStore.getState().finishHabitTimer(false);
      if (record) await applyFinishedTimerSession(record);
    },
  };
}
