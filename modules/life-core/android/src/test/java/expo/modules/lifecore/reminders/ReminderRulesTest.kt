package expo.modules.lifecore.reminders

import expo.modules.lifecore.widget.QueuedAction
import expo.modules.lifecore.widget.Schedule
import expo.modules.lifecore.widget.WidgetFixtures
import expo.modules.lifecore.widget.WidgetFixtures.FACE
import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.id
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.ms
import expo.modules.lifecore.widget.WidgetFixtures.paris
import expo.modules.lifecore.widget.WidgetFixtures.snapshot
import expo.modules.lifecore.widget.WidgetToday
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

class ReminderRulesTest {
  private fun habit(
    id: String,
    vararg times: String,
    schedule: Schedule = Schedule.Daily,
    lockScreenName: String? = null,
  ) = PlanHabit(id, "Name of $id", lockScreenName, schedule, times.map(LocalTime::parse))

  private fun plan(vararg habits: PlanHabit, enabled: Boolean = true) = ReminderPlan(enabled, "en", habits.toList())

  private fun paris(local: String): Long = java.time.LocalDateTime.parse(local).atZone(paris).toInstant().toEpochMilli()

  @Test
  fun theMomentsOnADateMatchTheAppsCases() {
    val fixture = JSONObject(File("../fixtures/reminder-moments.json").readText())
    val zone = ZoneId.of(fixture.getString("zone"))
    val cases = fixture.getJSONArray("cases")
    for (i in 0 until cases.length()) {
      val case = cases.getJSONObject(i)
      val times = case.getJSONArray("reminderTimes")
      val habit = PlanHabit(
        "h",
        "h",
        null,
        expo.modules.lifecore.widget.SnapshotJson.schedule(case.getJSONObject("schedule")),
        (0 until times.length()).map { LocalTime.parse(times.getString(it)) },
      )
      val expected = case.getJSONArray("moments").let { m -> (0 until m.length()).map { ms(m.getString(it)) } }
      assertEquals(case.getString("name"), expected, ReminderRules.momentsOn(habit, LocalDate.parse(case.getString("date")), zone))
    }
  }

  @Test
  fun theNextMomentIsLaterToday() {
    val next = ReminderRules.next(plan(habit(KEFIR, "09:00", "20:00")), paris("2026-03-10T08:00"), paris)
    assertEquals(paris("2026-03-10T09:00"), next)
  }

  @Test
  fun aMomentJustReachedIsNotNextAgain() {
    val next = ReminderRules.next(plan(habit(KEFIR, "09:00")), paris("2026-03-10T09:00"), paris)
    assertEquals(paris("2026-03-11T09:00"), next)
  }

  @Test
  fun theEarliestHabitWins() {
    val next = ReminderRules.next(plan(habit(KEFIR, "20:45"), habit(FACE, "11:00")), paris("2026-03-10T10:00"), paris)
    assertEquals(paris("2026-03-10T11:00"), next)
  }

  @Test
  fun aWeekdayHabitOnFridayEveningNextRemindsOnMonday() {
    val weekdays = habit(KEFIR, "07:45", schedule = Schedule.Weekdays(setOf(1, 2, 3, 4, 5)))
    assertEquals(paris("2026-03-16T07:45"), ReminderRules.next(plan(weekdays), paris("2026-03-13T19:00"), paris))
  }

  @Test
  fun anEveryNDaysHabitWaitsForItsFirstTurn() {
    val later = habit(KEFIR, "21:00", schedule = Schedule.EveryNDays(10, LocalDate.parse("2026-05-01")))
    assertEquals(paris("2026-05-01T21:00"), ReminderRules.next(plan(later), paris("2026-03-10T09:00"), paris))
    assertEquals(paris("2026-05-11T21:00"), ReminderRules.next(plan(later), paris("2026-05-01T21:00"), paris))
  }

  @Test
  fun overTheSpringChangeASkippedTimeIsAnHourLater() {
    val night = habit(KEFIR, "02:30")
    assertEquals(ms("2026-03-29T01:30:00.000Z"), ReminderRules.next(plan(night), paris("2026-03-28T23:00"), paris))
  }

  @Test
  fun remindersOffOrNoneSetMeanNoAlarm() {
    assertNull(ReminderRules.next(plan(habit(KEFIR, "09:00"), enabled = false), paris("2026-03-10T08:00"), paris))
    assertNull(ReminderRules.next(plan(), paris("2026-03-10T08:00"), paris))
  }

  // What goes out at the moment. The snapshot is 10 March, written at 09:30.

  private val kefirAt10 = habit(KEFIR, "10:00", lockScreenName = "Jar")
  private val tenAm = paris("2026-03-10T10:00")

  @Test
  fun aHabitStillToDoIsRemindedWithDone() {
    val posts = ReminderRules.toPost(plan(kefirAt10), tenAm, tenAm + 2_000, paris, WidgetToday.of(snapshot, emptyList(), tenAm, paris), null)
    assertEquals(listOf(ReminderPost(kefirAt10, offerDone = true)), posts)
  }

  @Test
  fun aHabitTickedOnTheWidgetIsNotReminded() {
    val tick = QueuedAction.HabitComplete(id(), tenAm - 60_000, march10, KEFIR)
    val today = WidgetToday.of(snapshot, listOf(tick), tenAm, paris)
    assertTrue(ReminderRules.toPost(plan(kefirAt10), tenAm, tenAm, paris, today, null).isEmpty())
  }

  @Test
  fun aHabitDoneInTheSnapshotIsNotReminded() {
    val mobility = habit(WidgetFixtures.MOBILITY, "10:00")
    val today = WidgetToday.of(snapshot, emptyList(), tenAm, paris)
    assertTrue(ReminderRules.toPost(plan(mobility), tenAm, tenAm, paris, today, null).isEmpty())
  }

  @Test
  fun afterMidnightAStaleSnapshotsDoneIsYesterdays() {
    val mobility = habit(WidgetFixtures.MOBILITY, "07:00", schedule = Schedule.Weekdays(setOf(1, 2, 3, 4, 5)))
    val wednesday = paris("2026-03-11T07:00")
    val today = WidgetToday.of(snapshot, emptyList(), wednesday, paris)
    val posts = ReminderRules.toPost(plan(mobility), wednesday, wednesday, paris, today, null)
    assertEquals(listOf(mobility.id), posts.map { it.habit.id })
  }

  @Test
  fun aTimerHabitIsRemindedWithoutDone() {
    val sit = habit(MEDITATION, "10:00")
    val posts = ReminderRules.toPost(plan(sit), tenAm, tenAm, paris, WidgetToday.of(snapshot, emptyList(), tenAm, paris), null)
    assertEquals(listOf(ReminderPost(sit, offerDone = false)), posts)
  }

  @Test
  fun aHabitWhoseTimerRunsIsNotReminded() {
    val sit = habit(MEDITATION, "10:00")
    val session = WidgetFixtures.timerSession().let { it.copy(request = it.request.copy(trackerId = MEDITATION)) }
    assertTrue(ReminderRules.toPost(plan(sit), tenAm, tenAm, paris, WidgetToday.of(snapshot, emptyList(), tenAm, paris), session).isEmpty())
  }

  @Test
  fun withoutASnapshotEveryHabitIsStillToDoAndNoneOffersDone() {
    val posts = ReminderRules.toPost(plan(kefirAt10), tenAm, tenAm, paris, null, null)
    assertEquals(listOf(ReminderPost(kefirAt10, offerDone = false)), posts)
  }

  @Test
  fun remindersSwitchedOffPostNothing() {
    val today = WidgetToday.of(snapshot, emptyList(), tenAm, paris)
    assertTrue(ReminderRules.toPost(plan(kefirAt10, enabled = false), tenAm, tenAm, paris, today, null).isEmpty())
  }

  @Test
  fun anAlarmMoreThanAnHourLateLetsTheMomentGo() {
    val late = tenAm + ReminderRules.LATE_LIMIT_MS + 1
    assertTrue(ReminderRules.toPost(plan(kefirAt10), tenAm, late, paris, null, null).isEmpty())
  }

  @Test
  fun aLateAlarmPostsEachHabitOnceAndNotTheOnesStillAhead() {
    val twice = habit(KEFIR, "10:00", "10:20")
    val face = habit(FACE, "20:45")
    val posts = ReminderRules.toPost(plan(twice, face), tenAm, paris("2026-03-10T10:30"), paris, null, null)
    assertEquals(listOf(KEFIR), posts.map { it.habit.id })
    assertFalse(posts.any { it.habit.id == FACE })
  }

  @Test
  fun thePlanReadsAsJavaScriptWritesIt() {
    val text = """{"version":1,"enabled":true,"language":"fr","habits":[{"id":"$KEFIR","name":"Burp the kefir","lockScreenName":null,"schedule":{"type":"weekdays","days":[1,3]},"reminderTimes":["09:00","20:00"]}]}"""
    val parsed = requireNotNull(ReminderPlanJson.parse(text))
    assertEquals("fr", parsed.language)
    assertEquals(
      PlanHabit(KEFIR, "Burp the kefir", null, Schedule.Weekdays(setOf(1, 3)), listOf(LocalTime.of(9, 0), LocalTime.of(20, 0))),
      parsed.habits.single(),
    )
    assertNull(ReminderPlanJson.parse(text.replace("\"version\":1", "\"version\":2")))
    assertNull(ReminderPlanJson.parse("{"))
  }

  // Reminders already on screen, once the app or the widget settles their habit.

  private val posted = setOf(KEFIR, MEDITATION, FACE)
  private val reminding = plan(habit(KEFIR, "10:00"), habit(MEDITATION, "10:00"), habit(FACE, "20:45"))

  private fun clear(today: expo.modules.lifecore.widget.Today?, timer: expo.modules.lifecore.TimerSession? = null, from: ReminderPlan? = reminding) =
    ReminderRules.toClear(posted, from, today, timer)

  @Test
  fun aHabitTickedInTheAppLosesItsReminder() {
    val ticked = snapshot.copy(trackers = snapshot.trackers.map { if (it.id == KEFIR) it.copy(done = true) else it })
    assertEquals(setOf(KEFIR), clear(WidgetToday.of(ticked, emptyList(), tenAm, paris)))
  }

  @Test
  fun aTimerFinishedOrRunningLosesItsReminder() {
    val finished = QueuedAction.TimerSessionDone(id(), tenAm - 1000, march10, MEDITATION, 60, trackCompleted = false, markComplete = true)
    assertEquals(setOf(MEDITATION), clear(WidgetToday.of(snapshot, listOf(finished), tenAm, paris)))
    val session = WidgetFixtures.timerSession().let { it.copy(request = it.request.copy(trackerId = MEDITATION)) }
    assertEquals(setOf(MEDITATION), clear(WidgetToday.of(snapshot, emptyList(), tenAm, paris), session))
  }

  @Test
  fun aHabitStillToDoKeepsItsReminderAndNothingIsEverReposted() {
    // Un-ticked again: not done, so nothing to clear; posting is only ever the alarm's.
    assertTrue(clear(WidgetToday.of(snapshot, emptyList(), tenAm, paris)).isEmpty())
    assertTrue(clear(null).isEmpty())
  }

  @Test
  fun aHabitArchivedOrDeletedLosesItsReminder() {
    val withoutFace = plan(habit(KEFIR, "10:00"), habit(MEDITATION, "10:00"))
    val gone = snapshot.copy(trackers = snapshot.trackers.filter { it.id != FACE })
    assertEquals(setOf(FACE), clear(WidgetToday.of(gone, emptyList(), tenAm, paris), from = withoutFace))
  }

  @Test
  fun noPlanOrRemindersOffClearsThemAll() {
    assertEquals(posted, clear(null, from = null))
    assertEquals(posted, clear(null, from = reminding.copy(enabled = false)))
  }
}
