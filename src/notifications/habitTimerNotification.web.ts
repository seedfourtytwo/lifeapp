import type { HabitTimerTargetFire } from './habitTimerTarget';

/** Notifications are not supported on web. */
export async function syncHabitTimerNotification(
  _target: HabitTimerTargetFire | null,
): Promise<void> {}
