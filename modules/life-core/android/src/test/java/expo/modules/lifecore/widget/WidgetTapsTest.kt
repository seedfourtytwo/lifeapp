package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import expo.modules.lifecore.TimerStartRequest
import expo.modules.lifecore.widget.WidgetFixtures.COMMITMENT
import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.WATER
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.paris
import expo.modules.lifecore.widget.WidgetFixtures.snapshot
import expo.modules.lifecore.widget.WidgetFixtures.tenAm
import expo.modules.lifecore.TimerSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetTapsTest {
  private val newIds = generateSequence(1) { it + 1 }.map { "00000000-0000-4000-8000-%012d".format(it) }.iterator()
  private val taps = WidgetTaps { newIds.next() }

  private fun decide(
    tap: Tap,
    lines: List<QueuedAction> = emptyList(),
    timer: TimerSession? = null,
    from: Snapshot? = snapshot,
    now: Long = tenAm,
  ): TapEffect = taps.decide(tap, from, lines, timer, now, paris)

  @Test
  fun aTickQueuesHabitComplete() {
    assertEquals(
      TapEffect.Queue(QueuedAction.HabitComplete("00000000-0000-4000-8000-000000000001", tenAm, march10, KEFIR)),
      decide(Tap.Tick(KEFIR)),
    )
  }

  @Test
  fun aTickOnADoneHabitATimerOrAGoneTrackerDoesNothing() {
    val ticked = QueuedAction.HabitComplete("a", tenAm - 1000, march10, KEFIR)
    assertEquals(TapEffect.Ignore, decide(Tap.Tick(KEFIR), listOf(ticked)))
    assertEquals(TapEffect.Ignore, decide(Tap.Tick(MEDITATION)))
    assertEquals(TapEffect.Ignore, decide(Tap.Tick(WATER)))
    assertEquals(TapEffect.Ignore, decide(Tap.Tick("550e8400-e29b-41d4-a716-446655449999")))
    assertEquals(TapEffect.Ignore, decide(Tap.Tick(KEFIR), from = null))
  }

  @Test
  fun aCounterButtonQueuesItsAmount() {
    assertEquals(
      TapEffect.Queue(QueuedAction.CounterAdd("00000000-0000-4000-8000-000000000001", tenAm, march10, WATER, 2.0)),
      decide(Tap.Add(WATER, 2.0)),
    )
    // An amount the counter has no button for, or a habit, is a stale widget.
    assertEquals(TapEffect.Ignore, decide(Tap.Add(WATER, 5.0)))
    assertEquals(TapEffect.Ignore, decide(Tap.Add(KEFIR, 1.0)))
  }

  @Test
  fun playStartsTheTimerWithItsSoundAndTodaysSeconds() {
    val effect = decide(Tap.StartTimer(MEDITATION))
    assertEquals(
      TapEffect.Start(
        TimerStartRequest(
          trackerId = MEDITATION,
          name = "Meditation",
          lockScreenName = "Sit",
          iconKey = "meditation",
          goal = TimerGoal.Seconds(900),
          trackId = "meditation15min",
          loop = true,
          loggedSeconds = 120,
        ),
      ),
      effect,
    )
    // Seconds logged by a session the app has not applied yet count too.
    val session = QueuedAction.TimerSessionDone("s", tenAm - 1000, march10, MEDITATION, 200, false, false)
    assertEquals(320, (decide(Tap.StartTimer(MEDITATION), listOf(session)) as TapEffect.Start).request.loggedSeconds)
  }

  @Test
  fun playIsRefusedForACheckOffOrWhileAnotherTimerRuns() {
    assertEquals(TapEffect.Ignore, decide(Tap.StartTimer(KEFIR)))
    val other = WidgetFixtures.timerSession()
    assertEquals(TapEffect.Ignore, decide(Tap.StartTimer(MEDITATION), timer = other))
    val same = other.copy(request = other.request.copy(trackerId = MEDITATION))
    assertTrue(decide(Tap.StartTimer(MEDITATION), timer = same) is TapEffect.Start)
  }

  @Test
  fun timerButtonsNeedASessionThatCanTakeThem() {
    val paused = WidgetFixtures.timerSession()
    val running = paused.resume(tenAm)
    assertEquals(TapEffect.Ignore, decide(Tap.Pause))
    assertEquals(TapEffect.Ignore, decide(Tap.Pause, timer = paused))
    assertEquals(TapEffect.PauseTimer, decide(Tap.Pause, timer = running))
    assertEquals(TapEffect.ResumeTimer, decide(Tap.Resume, timer = paused))
    assertEquals(TapEffect.Ignore, decide(Tap.Resume, timer = running))
    assertEquals(TapEffect.FinishTimer, decide(Tap.Done, timer = paused))
    assertEquals(TapEffect.DiscardTimer, decide(Tap.Discard, timer = running))
    assertEquals(TapEffect.Ignore, decide(Tap.Done))
    assertEquals(TapEffect.Ignore, decide(Tap.Discard))
  }

  @Test
  fun urgeLogsOneUrgeAndUsedEndsThatRideOnly() {
    val logged = decide(Tap.Urge) as TapEffect.Queue
    val urge = logged.action as QueuedAction.UrgeLogged
    assertEquals(QueuedAction.UrgeLogged("00000000-0000-4000-8000-000000000001", tenAm, march10), urge)
    // While it rides, a second Urge is a stale widget.
    assertEquals(TapEffect.Ignore, decide(Tap.Urge, listOf(urge), now = tenAm + 1000))
    assertEquals(
      TapEffect.Queue(QueuedAction.UrgeResolved("00000000-0000-4000-8000-000000000002", tenAm + 1000, march10, urge.id)),
      decide(Tap.Used(urge.id), listOf(urge), now = tenAm + 1000),
    )
    assertEquals(TapEffect.Ignore, decide(Tap.Used("another"), listOf(urge), now = tenAm + 1000))
    // Its ride over, "used" no longer applies.
    assertEquals(TapEffect.Ignore, decide(Tap.Used(urge.id), listOf(urge), now = tenAm + 600_000))
  }

  @Test
  fun playMyNotePlaysItWithOrWithoutATimer() {
    assertEquals(TapEffect.PlayNote, decide(Tap.PlayNote))
    assertEquals(TapEffect.PlayNote, decide(Tap.PlayNote, timer = WidgetFixtures.timerSession().resume(tenAm), from = null))
  }

  @Test
  fun anUrgeWorksWithoutACommitmentOrASnapshot() {
    assertTrue(decide(Tap.Urge, from = snapshot.copy(commitment = null, trackers = snapshot.trackers.filter { it.id != COMMITMENT })) is TapEffect.Queue)
    assertTrue(decide(Tap.Urge, from = null) is TapEffect.Queue)
  }

  @Test
  fun theSameTapTwiceInAMomentIsOneTap() {
    val guard = TapGuard(windowMs = 600)
    assertTrue(guard.accept(Tap.Add(WATER, 1.0), tenAm))
    assertFalse(guard.accept(Tap.Add(WATER, 1.0), tenAm + 300))
    assertTrue(guard.accept(Tap.Tick(KEFIR), tenAm + 400))
    assertTrue(guard.accept(Tap.Add(WATER, 1.0), tenAm + 1000))
  }

  @Test
  fun eachButtonCarriesItsTapAndOnlyThat() {
    val all = listOf(
      Tap.Tick(KEFIR), Tap.Add(WATER, 2.0), Tap.Add(WATER, 0.5), Tap.StartTimer(MEDITATION),
      Tap.Pause, Tap.Resume, Tap.Done, Tap.Discard, Tap.Urge, Tap.Used("7a0e4c2d-1b3f-4e5a-9c6d-8f2e1a3b4c5d"), Tap.PlayNote,
    )
    for (tap in all) assertEquals(tap, TapCodec.decode(TapCodec.encode(tap)))
    assertEquals(all.size, all.map(TapCodec::encode).toSet().size)
    for (junk in listOf("", "tick", "tick/", "add/$WATER", "add/$WATER/many", "launch/$KEFIR", "pause/extra")) {
      assertEquals(junk, null, TapCodec.decode(junk))
    }
  }

  @Test
  fun aFinishedSessionIsRememberedAsItsQueueLine() {
    val session = WidgetFixtures.timerSession()
    val record = session.finish(tenAm, "2026-03-10", markComplete = true, trackCompleted = false)
    assertEquals(
      QueuedAction.TimerSessionDone(record.id, tenAm, march10, record.trackerId, record.activeSeconds, false, true),
      QueuedAction.TimerSessionDone.of(record),
    )
  }
}
