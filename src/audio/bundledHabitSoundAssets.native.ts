/**
 * Map catalog ids to bundled audio modules (96 kbps MP3s under assets/sounds/).
 * Add a require() entry for each file in assets/sounds/.
 */
const BUNDLED_SOUND_ASSETS: Record<string, number> = {
  meditation15min: require('../../assets/sounds/meditation15min.mp3'),
  meditation30min: require('../../assets/sounds/meditation30min.mp3'),
  wimhofMorning: require('../../assets/sounds/wimhofMorning.mp3'),
  wimhofEvening: require('../../assets/sounds/wimhofEvening.mp3'),
};

/** Muted loop so timers without a habit track still own the OS media session. */
export const TIMER_KEEPALIVE_SOUND_MODULE = require('../../assets/sounds/timerKeepalive.mp3');

export function getBundledHabitSoundModule(trackId: string): number | undefined {
  return BUNDLED_SOUND_ASSETS[trackId];
}
