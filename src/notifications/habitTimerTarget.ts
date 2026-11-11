import {
  habitTimerGoal,
  parseHabitConfig,
  type ActiveTimerSession,
  type ElementDefinition,
} from '../protocol';
import { isElementArchived } from '../utils/dashboardElements';

export type HabitTimerTargetFire = {
  elementId: string;
  name: string;
  fireAt: Date;
};

/**
 * When the running timer reaches its habit's seconds target, or null when no
 * running timer has one still ahead. A paused timer has no fire time; resuming
 * gives a new one. Depends only on the session and what was logged before it,
 * so it is the same instant however often it is asked.
 */
export function habitTimerTargetFire(
  input: {
    sessions: Record<string, ActiveTimerSession>;
    elements: readonly ElementDefinition[];
    dailyTotals: Record<string, number>;
    dayMapsDate: string;
  },
  nowMs: number = Date.now(),
): HabitTimerTargetFire | null {
  for (const [elementId, session] of Object.entries(input.sessions)) {
    if (session.pausedAt) continue;
    const element = input.elements.find(
      (candidate) =>
        candidate.id === elementId && candidate.kind === 'habit' && !isElementArchived(candidate),
    );
    if (!element) continue;
    const config = parseHabitConfig(element.config);
    const goal = habitTimerGoal(config);
    if (config.trackingMode !== 'timer' || goal.type !== 'seconds') continue;

    const logged =
      session.calendarDate === input.dayMapsDate ? (input.dailyTotals[elementId] ?? 0) : 0;
    const fireAtMs =
      new Date(session.startedAt).getTime() +
      session.pauseOffsetMs +
      (goal.seconds - logged) * 1000;
    if (fireAtMs <= nowMs) continue;
    return { elementId, name: element.name, fireAt: new Date(fireAtMs) };
  }
  return null;
}
