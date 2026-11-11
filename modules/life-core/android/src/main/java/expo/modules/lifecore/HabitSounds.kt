package expo.modules.lifecore

/**
 * The bundled sounds, in this module's `res/raw` so they exist without Metro.
 * The track ids are the ones `src/protocol/habitSoundCatalog.ts` lists, with
 * its labels and durations; `__tests__/habitSoundNativeCatalog.test.ts` reads
 * this file and fails when the two lists drift apart.
 */
object HabitSounds {
  val tracks: Map<String, Int> = mapOf(
    "meditation15min" to R.raw.meditation15min,
    "meditation30min" to R.raw.meditation30min,
    "wimhofMorning" to R.raw.wimhof_morning,
    "wimhofEvening" to R.raw.wimhof_evening,
  )

  /** A short silent loop that keeps a timer without a track playing, so the phone stays awake for it. */
  val keepalive: Int = R.raw.timer_keepalive

  /** Rings when a seconds goal is reached or a play-once track ends. */
  val chime: Int = R.raw.habit_complete
}
