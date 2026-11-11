package expo.modules.lifecore

/** The goal in force when a session started, as JavaScript's `habitTimerGoal` gave it. */
sealed interface TimerGoal {
  data class Seconds(val seconds: Int) : TimerGoal
  data class PlayOnce(val trackSeconds: Int) : TimerGoal
  data object Open : TimerGoal
}

/** What the app asks the core to start (`TimerStartRequestSchema`). */
data class TimerStartRequest(
  val trackerId: String,
  val name: String,
  val lockScreenName: String?,
  val iconKey: String?,
  val goal: TimerGoal,
  val trackId: String?,
  val loop: Boolean,
  val loggedSeconds: Int,
)

/** A finished session: one `timer_session` line of the pending-actions queue. */
data class TimerSessionRecord(
  val id: String,
  val atMs: Long,
  val day: String,
  val trackerId: String,
  val startedAtMs: Long,
  val endedAtMs: Long,
  val pausedMs: Long,
  val activeSeconds: Long,
  val goalSecondsInForce: Int?,
  val trackCompleted: Boolean,
  val markComplete: Boolean,
)

/**
 * The one running or paused session, as `timer.json` holds it. Pure: every
 * step takes the moment it happens and returns the next session, or this
 * very object when nothing changes. Elapsed time always comes from these
 * instants, never from counted ticks, because a sleeping phone stretches ticks.
 */
data class TimerSession(
  val request: TimerStartRequest,
  val startedAtMs: Long,
  val pausedAtMs: Long?,
  /** Milliseconds in pauses that have ended. */
  val pausedMs: Long,
  /** The app day (local date) the session started on. */
  val day: String,
  val goalReachedAtMs: Long?,
  /** Last moment a live process was running the session. */
  val heartbeatAtMs: Long,
) {
  val isPaused: Boolean get() = pausedAtMs != null

  fun pause(nowMs: Long): TimerSession =
    if (isPaused) this else copy(pausedAtMs = nowMs, heartbeatAtMs = nowMs)

  fun resume(nowMs: Long): TimerSession {
    val pausedAt = pausedAtMs ?: return this
    // A clock set back while paused must not make the pause negative.
    return copy(pausedAtMs = null, pausedMs = pausedMs + maxOf(0L, nowMs - pausedAt), heartbeatAtMs = nowMs)
  }

  fun heartbeat(nowMs: Long): TimerSession = if (isPaused) this else copy(heartbeatAtMs = nowMs)

  fun activeMs(nowMs: Long): Long = maxOf(0L, (pausedAtMs ?: nowMs) - startedAtMs - pausedMs)

  /**
   * The process that ran this session is gone and nothing has counted since
   * its last heartbeat: it stands paused there, resumable, so the dead time
   * is not counted (the stage 4 rule).
   */
  fun pauseAtLastHeartbeat(nowMs: Long): TimerSession =
    if (isPaused || nowMs - heartbeatAtMs <= HEARTBEAT_STALE_MS) this else copy(pausedAtMs = heartbeatAtMs)

  /** When a running session reaches its seconds goal, counting what today logged before it. */
  fun goalAtMs(): Long? {
    val goal = request.goal as? TimerGoal.Seconds ?: return null
    if (isPaused || goalReachedAtMs != null) return null
    return startedAtMs + pausedMs + (goal.seconds - request.loggedSeconds) * 1000L
  }

  fun reachGoal(nowMs: Long): TimerSession {
    val goalAt = goalAtMs() ?: return this
    return if (nowMs < goalAt) this else copy(goalReachedAtMs = nowMs)
  }

  fun finish(
    nowMs: Long,
    dayAtFinish: String,
    id: String,
    markComplete: Boolean,
    trackCompleted: Boolean,
  ): TimerSessionRecord {
    val endedAt = pausedAtMs ?: nowMs
    return TimerSessionRecord(
      id = id,
      atMs = nowMs,
      day = dayAtFinish,
      trackerId = request.trackerId,
      startedAtMs = startedAtMs,
      endedAtMs = endedAt,
      pausedMs = pausedMs,
      activeSeconds = activeMs(endedAt) / 1000,
      goalSecondsInForce = (request.goal as? TimerGoal.Seconds)?.seconds,
      trackCompleted = trackCompleted,
      markComplete = markComplete,
    )
  }

  companion object {
    /** How often a running session records that its process is alive. */
    const val HEARTBEAT_MS = 30_000L
    /** A heartbeat older than this, found by a fresh process, means the old one died. */
    const val HEARTBEAT_STALE_MS = 2 * HEARTBEAT_MS

    fun start(request: TimerStartRequest, nowMs: Long, day: String) = TimerSession(
      request = request,
      startedAtMs = nowMs,
      pausedAtMs = null,
      pausedMs = 0,
      day = day,
      goalReachedAtMs = null,
      heartbeatAtMs = nowMs,
    )
  }
}
