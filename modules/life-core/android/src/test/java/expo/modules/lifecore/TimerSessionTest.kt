package expo.modules.lifecore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

/** The same cases as `__tests__/timerSessions.test.ts`, and the dead-process rule of stage 4. */
class TimerSessionTest {
  private val t0 = 1_773_129_600_000L // 2026-03-10T08:00:00Z
  private val request = TimerStartRequest(
    trackerId = "550e8400-e29b-41d4-a716-446655440001",
    name = "Meditation",
    lockScreenName = "Sit",
    iconKey = "meditation",
    goal = TimerGoal.Seconds(900),
    trackId = "meditation15min",
    loop = true,
    loggedSeconds = 0,
  )

  private fun started(nowMs: Long = t0) = TimerSession.start(request, nowMs, "2026-03-10", SESSION_ID)

  @Test
  fun startsRunningWithAFreshHeartbeat() {
    val session = started()
    assertEquals(t0, session.startedAtMs)
    assertNull(session.pausedAtMs)
    assertEquals(0L, session.pausedMs)
    assertEquals(t0, session.heartbeatAtMs)
    assertEquals("2026-03-10", session.day)
  }

  @Test
  fun startsPausesAndResumesCountingThePause() {
    val paused = started().pause(t0 + 60_000)
    val resumed = paused.resume(t0 + 90_000)

    assertEquals(t0 + 60_000, paused.pausedAtMs)
    assertNull(resumed.pausedAtMs)
    assertEquals(30_000L, resumed.pausedMs)
  }

  @Test
  fun handsBackTheSameSessionWhenAStepChangesNothing() {
    val running = started()
    assertSame(running, running.resume(t0 + 1))
    val paused = running.pause(t0 + 1_000)
    assertSame(paused, paused.pause(t0 + 2_000))
    assertSame(paused, paused.heartbeat(t0 + 80_000))
  }

  @Test
  fun neverMakesThePauseNegativeWhenTheClockWentBack() {
    val resumed = started().pause(t0 + 60_000).resume(t0 - 3_600_000)
    assertEquals(0L, resumed.pausedMs)
  }

  @Test
  fun countsActiveTimeFromInstantsNotTicks() {
    val session = started().pause(t0 + 10_000).resume(t0 + 15_000)
    assertEquals(55_000L, session.activeMs(t0 + 60_000))
    assertEquals(10_000L, started().pause(t0 + 10_000).activeMs(t0 + 3_600_000))
    assertEquals(0L, started().activeMs(t0 - 5_000))
  }

  @Test
  fun aResumeStampsTheHeartbeatSoAPauseIsNotTakenForADeath() {
    val resumed = started().pause(t0 + 2_000).resume(t0 + 600_000)
    assertEquals(t0 + 600_000, resumed.heartbeatAtMs)
  }

  @Test
  fun aSessionLeftRunningByADeadProcessPausesAtItsLastHeartbeat() {
    val session = started().heartbeat(t0 + 20 * 60_000)
    val restored = session.pauseAtLastHeartbeat()

    assertEquals(t0 + 20 * 60_000, restored.pausedAtMs)
    assertEquals(20 * 60_000L, restored.activeMs(t0 + 3 * 3_600_000))
  }

  @Test
  fun evenARecentHeartbeatIsWhereTheDeadProcessStopped() {
    // Only a fresh process asks, and a fresh process has no service playing
    // the session: the seconds since the last beat were not watched by anyone.
    val session = started().heartbeat(t0 + 60_000)
    assertEquals(t0 + 60_000, session.pauseAtLastHeartbeat().pausedAtMs)
  }

  @Test
  fun leavesAPausedSessionAlone() {
    val paused = started().pause(t0 + 5 * 60_000)
    assertSame(paused, paused.pauseAtLastHeartbeat())
  }

  @Test
  fun reachesTheGoalAfterTheSecondsNotYetLoggedToday() {
    val session = TimerSession.start(request.copy(loggedSeconds = 300), t0, "2026-03-10", SESSION_ID)
    assertEquals(t0 + 600_000, session.goalAtMs())
    val afterPause = session.pause(t0 + 60_000).resume(t0 + 90_000)
    assertEquals(t0 + 630_000, afterPause.goalAtMs())
  }

  @Test
  fun hasNoGoalMomentWhilePausedOrWithoutASecondsGoalOrOnceReached() {
    assertNull(started().pause(t0 + 1).goalAtMs())
    assertNull(TimerSession.start(request.copy(goal = TimerGoal.Open), t0, "2026-03-10", SESSION_ID).goalAtMs())
    assertNull(TimerSession.start(request.copy(goal = TimerGoal.PlayOnce(912)), t0, "2026-03-10", SESSION_ID).goalAtMs())
    assertNull(started().reachGoal(t0 + 900_000).goalAtMs())
  }

  @Test
  fun hasNoGoalMomentWhenTodayAlreadyReachedTheGoalBeforeTheSession() {
    // No chime for a day that was done before this session started.
    assertNull(TimerSession.start(request.copy(loggedSeconds = 900), t0, "2026-03-10", SESSION_ID).goalAtMs())
  }

  @Test
  fun marksTheGoalOnlyOnceItsTimeHasCome() {
    val session = started()
    assertSame(session, session.reachGoal(t0 + 899_000))
    val reached = session.reachGoal(t0 + 900_000)
    assertEquals(t0 + 900_000, reached.goalReachedAtMs)
    assertSame(reached, reached.reachGoal(t0 + 950_000))
  }

  @Test
  fun finishesARunningSessionIntoItsRecord() {
    val session = started().pause(t0 + 10_000).resume(t0 + 15_000)
    val record = session.finish(t0 + 65_500, "2026-03-10", markComplete = true, trackCompleted = false)

    assertEquals(
      TimerSessionRecord(
        id = SESSION_ID,
        atMs = t0 + 65_500,
        day = "2026-03-10",
        trackerId = request.trackerId,
        startedAtMs = t0,
        endedAtMs = t0 + 65_500,
        pausedMs = 5_000,
        activeSeconds = 60,
        goalSecondsInForce = 900,
        trackCompleted = false,
        markComplete = true,
      ),
      record,
    )
  }

  @Test
  fun endsAPausedSessionAtItsPause() {
    val session = TimerSession.start(request.copy(goal = TimerGoal.Open), t0, "2026-03-10", SESSION_ID).pause(t0 + 120_000)
    val record = session.finish(t0 + 3_720_000, "2026-03-10", markComplete = false, trackCompleted = false)

    assertEquals(t0 + 120_000, record.endedAtMs)
    assertEquals(120, record.activeSeconds)
    assertNull(record.goalSecondsInForce)
  }

  private companion object {
    const val SESSION_ID = "6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11"
  }
}
