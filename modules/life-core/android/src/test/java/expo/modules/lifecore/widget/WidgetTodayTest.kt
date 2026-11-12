package expo.modules.lifecore.widget

import expo.modules.lifecore.widget.WidgetFixtures.COMMITMENT
import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.MOBILITY
import expo.modules.lifecore.widget.WidgetFixtures.WATER
import expo.modules.lifecore.widget.WidgetFixtures.id
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.ms
import expo.modules.lifecore.widget.WidgetFixtures.paris
import expo.modules.lifecore.widget.WidgetFixtures.snapshot
import expo.modules.lifecore.widget.WidgetFixtures.tenAm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class WidgetTodayTest {
  private fun today(lines: List<QueuedAction> = emptyList(), now: Long = tenAm) = WidgetToday.of(snapshot, lines, now, paris)

  private fun Today.of(id: String) = requireNotNull(tracker(id))

  private fun session(seconds: Long, markComplete: Boolean = false, trackCompleted: Boolean = false) =
    QueuedAction.TimerSessionDone(id(), tenAm - 60_000, march10, MEDITATION, seconds, trackCompleted, markComplete)

  @Test
  fun aFreshSnapshotIsTakenAsItIs() {
    val today = today()
    assertEquals(march10, today.date)
    // Mobility and the commitment, of everything due.
    assertEquals(2, today.doneCount)
    assertEquals(6, today.dueCount)
    assertEquals(120.0, today.of(MEDITATION).total, 0.0)
    assertEquals(2, today.of(MEDITATION).streak)
  }

  @Test
  fun aTickShowsBeforeTheAppAppliesIt() {
    val today = today(listOf(QueuedAction.HabitComplete(id(), tenAm - 1000, march10, KEFIR)))
    assertTrue(today.of(KEFIR).done)
    assertEquals(StripState.DONE, today.of(KEFIR).sevenDays.last())
    assertEquals(3, today.doneCount)
  }

  @Test
  fun aLineTheSnapshotAlreadyHoldsIsNotCountedAgain() {
    val before = ms("2026-03-10T08:30:00.000Z")
    val today = today(listOf(QueuedAction.CounterAdd(id(), before, march10, WATER, 3.0)))
    assertEquals(5.0, today.of(WATER).total, 0.0)
  }

  @Test
  fun theSameLineReadTwiceCountsOnce() {
    val line = QueuedAction.CounterAdd(id(), tenAm - 1000, march10, WATER, 1.0)
    assertEquals(6.0, today(listOf(line, line)).of(WATER).total, 0.0)
  }

  @Test
  fun aCounterIsDoneAtItsTarget() {
    val two = QueuedAction.CounterAdd(id(), tenAm - 2000, march10, WATER, 2.0)
    assertFalse(today(listOf(two)).of(WATER).done)
    val one = QueuedAction.CounterAdd(id(), tenAm - 1000, march10, WATER, 1.0)
    assertTrue(today(listOf(two, one)).of(WATER).done)
  }

  @Test
  fun aFinishedSessionAddsItsSecondsAndIsDoneByGoalOrDone() {
    assertFalse(today(listOf(session(779))).of(MEDITATION).done)
    assertTrue(today(listOf(session(780))).of(MEDITATION).done)
    assertTrue(today(listOf(session(60, markComplete = true))).of(MEDITATION).done)
    assertEquals(900.0, today(listOf(session(780))).of(MEDITATION).total, 0.0)
  }

  @Test
  fun aTickForATimerHabitIsNotApplied() {
    assertFalse(today(listOf(QueuedAction.HabitComplete(id(), tenAm - 1000, march10, MEDITATION))).of(MEDITATION).done)
  }

  @Test
  fun aLineFromYesterdayDoesNotCountToday() {
    val tomorrowMorning = ms("2026-03-11T07:00:00.000Z")
    val line = QueuedAction.HabitComplete(id(), ms("2026-03-10T22:30:00.000Z"), march10, KEFIR)
    assertFalse(today(listOf(line), tomorrowMorning).of(KEFIR).done)
  }

  @Test
  fun theNextDayStartsAfreshWithoutTheApp() {
    // Wednesday 11 March, 08:00 in Paris.
    val today = today(now = ms("2026-03-11T07:00:00.000Z"))
    assertEquals(LocalDate.parse("2026-03-11"), today.date)
    val kefir = today.of(KEFIR)
    assertFalse(kefir.done)
    assertEquals(0.0, kefir.total, 0.0)
    // Due yesterday and not done: the run is broken.
    assertEquals(0, kefir.streak)
    assertEquals(
      listOf(StripState.NOT_DONE, StripState.NOT_DONE, StripState.DONE, StripState.DONE, StripState.DONE, StripState.NOT_DONE, StripState.NOT_DONE),
      kefir.sevenDays,
    )
    // Done yesterday: the run stands.
    assertEquals(1, today.of(MOBILITY).streak)
    assertEquals(0.0, today.of(MEDITATION).total, 0.0)
    // The commitment's new day is kept until a slip says otherwise.
    assertTrue(today.of(COMMITMENT).done)
    assertEquals(StripState.DONE, today.commitment?.sevenDays?.last())
    assertEquals(0, today.commitment?.urgesToday)
    assertEquals(1, today.doneCount)
  }

  @Test
  fun aWeekendDayFollowsTheSchedule() {
    // Saturday 14 March: weekdays-only Mobility is not due; the streaks are unknown four days on.
    val today = today(now = ms("2026-03-14T09:00:00.000Z"))
    assertFalse(today.of(MOBILITY).due)
    assertEquals(StripState.NOT_DUE, today.of(MOBILITY).sevenDays.last())
    assertEquals(StripState.NOT_DONE, today.of(MOBILITY).sevenDays[5])
    assertNull(today.of(KEFIR).streak)
    assertEquals(5, today.dueCount)
  }

  @Test
  fun aSnapshotWeeksOldStillGivesSevenDays() {
    val today = today(now = ms("2026-04-30T09:00:00.000Z"))
    assertEquals(List(7) { StripState.NOT_DONE }, today.of(KEFIR).sevenDays)
  }

  @Test
  fun anUrgeRidesForTheCommitmentsRideAndThenCountsAsRiddenOut() {
    val urge = QueuedAction.UrgeLogged(id(), tenAm, march10)
    val riding = today(listOf(urge), tenAm + 60_000)
    assertEquals(Ride(urge.id, tenAm, tenAm + 600_000), riding.ride)
    assertEquals(2, riding.commitment?.urgesToday)
    assertEquals(12, riding.commitment?.urgesRiddenOut)

    val after = today(listOf(urge), tenAm + 600_000)
    assertNull(after.ride)
    assertEquals(13, after.commitment?.urgesRiddenOut)
  }

  @Test
  fun usedEndsTheRideAndIsNotRiddenOut() {
    val urge = QueuedAction.UrgeLogged(id(), tenAm, march10)
    val used = QueuedAction.UrgeResolved(id(), tenAm + 1000, march10, urge.id)
    val today = today(listOf(urge, used), tenAm + 700_000)
    assertNull(today.ride)
    assertEquals(12, today.commitment?.urgesRiddenOut)
  }

  @Test
  fun theSnapshotsRideEndsUntouchedWhileNobodyLooks() {
    val ride = Ride(id(), ms("2026-03-10T08:25:00.000Z"), ms("2026-03-10T08:35:00.000Z"))
    val riding = WidgetToday.of(snapshot.copy(ride = ride), emptyList(), ms("2026-03-10T08:31:00.000Z"), paris)
    assertEquals(ride, riding.ride)
    val later = WidgetToday.of(snapshot.copy(ride = ride), emptyList(), tenAm, paris)
    assertNull(later.ride)
    assertEquals(13, later.commitment?.urgesRiddenOut)
  }

  @Test
  fun theOwnLineMovesOnAtALampWithoutTheApp() {
    // 72.5 hours clear: three lamps passed.
    assertEquals("I sleep better", today().commitment?.ownLine)
    assertEquals(Lamps.Next(120, ms("2026-03-12T08:30:00.000Z")), today().commitment?.nextLamp)
    val atTheFifthDay = today(now = ms("2026-03-12T08:30:00.000Z")).commitment
    assertEquals("Money for the trip", atTheFifthDay?.ownLine)
    assertEquals(Lamps.Next(168, ms("2026-03-14T08:30:00.000Z")), atTheFifthDay?.nextLamp)
  }

  @Test
  fun theRoadToTheLampFillsFromTheLastLamp() {
    // From the 72 h lamp to the 120 h one, half an hour in.
    assertEquals(0.5 / 48, requireNotNull(today().commitment).towardLamp, 1e-9)
  }
}
