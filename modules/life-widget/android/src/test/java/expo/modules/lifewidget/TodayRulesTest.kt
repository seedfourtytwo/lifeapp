package expo.modules.lifewidget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.LocalDate

class TodayRulesTest {
  private fun habit(json: String): HabitRules {
    @Suppress("UNCHECKED_CAST")
    val map = MiniJson.parse(json) as Map<String, Any?>
    return TodayRules.parseHabitConfig(map)!!
  }

  private val monday = LocalDate.parse("2026-11-16")

  @Test
  fun parsesDefaults() {
    val rules = habit("{}")
    assertFalse(rules.timer)
    assertEquals(Schedule.Daily, rules.schedule)
  }

  @Test
  fun rejectsUnknownSchedule() {
    @Suppress("UNCHECKED_CAST")
    val map = MiniJson.parse("""{"schedule":{"type":"lunar"}}""") as Map<String, Any?>
    assertNull(TodayRules.parseHabitConfig(map))
  }

  @Test
  fun weekdaysUseSundayZero() {
    val rules = habit("""{"schedule":{"type":"weekdays","days":[1,3]}}""")
    assertTrue(TodayRules.isScheduledOn(rules.schedule, monday))
    assertFalse(TodayRules.isScheduledOn(rules.schedule, monday.plusDays(1)))
    val sunday = habit("""{"schedule":{"type":"weekdays","days":[0]}}""")
    assertTrue(TodayRules.isScheduledOn(sunday.schedule, LocalDate.parse("2026-11-22")))
  }

  @Test
  fun everyNDaysUsesCalendarDays() {
    val rules = habit("""{"schedule":{"type":"every_n_days","interval":3,"anchorDate":"2026-11-10"}}""")
    assertTrue(TodayRules.isScheduledOn(rules.schedule, LocalDate.parse("2026-11-16")))
    assertFalse(TodayRules.isScheduledOn(rules.schedule, LocalDate.parse("2026-11-17")))
    assertFalse(TodayRules.isScheduledOn(rules.schedule, LocalDate.parse("2026-11-07")))
  }

  @Test
  fun timesPerWeekCountsEarlierCompleteDays() {
    val rules = habit("""{"schedule":{"type":"times_per_week","times":2}}""")
    val wednesday = monday.plusDays(2)
    val done = setOf(monday, monday.plusDays(1))
    val facts = { d: LocalDate -> if (d in done) DayFacts(total = 1.0) else DayFacts.EMPTY }
    val state = TodayRules.habitDayState(rules, wednesday, facts)
    assertFalse(state.due)
    val oneDone = { d: LocalDate -> if (d == monday) DayFacts(total = 1.0) else DayFacts.EMPTY }
    assertTrue(TodayRules.habitDayState(rules, wednesday, oneDone).due)
    // Today complete keeps it due (and done) even past the quota.
    val allDone = { d: LocalDate -> if (d in done || d == wednesday) DayFacts(total = 1.0) else DayFacts.EMPTY }
    val today = TodayRules.habitDayState(rules, wednesday, allDone)
    assertTrue(today.due)
    assertTrue(today.done)
  }

  @Test
  fun skipMakesTheDayNotDue() {
    val rules = habit("{}")
    val state = TodayRules.habitDayState(rules, monday) { DayFacts(hasSkip = true) }
    assertTrue(state.skipped)
    assertFalse(state.due)
    val doneAnyway = TodayRules.habitDayState(rules, monday) { DayFacts(total = 1.0, hasSkip = true) }
    assertFalse(doneAnyway.skipped)
    assertTrue(doneAnyway.done)
  }

  @Test
  fun timerCompletion() {
    val target = habit("""{"trackingMode":"timer","dailyTargetSeconds":600}""")
    assertFalse(TodayRules.isHabitDayComplete(target, DayFacts(total = 599.0)))
    assertTrue(TodayRules.isHabitDayComplete(target, DayFacts(total = 600.0)))
    val open = habit("""{"trackingMode":"timer"}""")
    assertTrue(TodayRules.isHabitDayComplete(open, DayFacts(total = 1.0)))
    val playOnce = habit(
      """{"trackingMode":"timer","timerSound":{"trackId":"meditation15min","playbackMode":"play_once"}}""",
    )
    assertEquals(915, playOnce.playOnceTrackSeconds)
    assertFalse(TodayRules.isHabitDayComplete(playOnce, DayFacts(total = 2000.0)))
    assertTrue(TodayRules.isHabitDayComplete(playOnce, DayFacts(total = 900.0, trackCompleted = true)))
  }

  @Test
  fun visibilityWindowWrapsMidnight() {
    val rules = habit("""{"visibleOnlyInTimeRange":true,"timeRange":{"start":"22:00","end":"02:00"}}""")
    assertTrue(TodayRules.isVisibleAt(rules, 23 * 60))
    assertTrue(TodayRules.isVisibleAt(rules, 60))
    assertFalse(TodayRules.isVisibleAt(rules, 2 * 60))
    assertFalse(TodayRules.isVisibleAt(rules, 12 * 60))
  }

  @Test
  fun buildsRowsInOrder() {
    val open = HabitInput("a", "Open", habit("{}"))
    val done = HabitInput("b", "Done", habit("{}"))
    val skipped = HabitInput("c", "Skipped", habit("{}"))
    val hidden = HabitInput(
      "d",
      "Hidden",
      habit("""{"visibleOnlyInTimeRange":true,"timeRange":{"start":"06:00","end":"07:00"}}"""),
    )
    val counter = CounterInput("k", "Water", CounterRules(listOf(1.0, 5.0, 10.0), 8), 3.0)
    val todos = listOf(
      TodoInput("t1", "Later", null, 0),
      TodoInput("t2", "Overdue", "2026-11-01", 5),
    )
    val facts = { id: String, _: LocalDate ->
      when (id) {
        "b" -> DayFacts(total = 1.0)
        "c" -> DayFacts(hasSkip = true)
        else -> DayFacts.EMPTY
      }
    }
    val model = TodayRules.buildToday(listOf(done, open, skipped, hidden), facts, listOf(counter), todos, monday, 12 * 60)
    // Habits and counters are one run in the user's own order, with no heading
    // over them: what is still to do today is what the widget is for, and a
    // heading saying so costs a row on a screen that has few.
    assertEquals(
      listOf(
        "habit:a", "counter:k",
        "label:todos", "todo:t2", "todo:t1",
        "label:done", "habit:b", "habit:c",
      ),
      model.rows.map { it.key },
    )
    // Due: a, b, the targeted counter and the two open todos. Done: b.
    assertEquals(5, model.due)
    assertEquals(1, model.done)
    val counterRow = model.rows.filterIsInstance<WidgetRow.Counter>().single()
    assertEquals(listOf(1.0, 5.0), counterRow.increments)
    assertFalse(counterRow.done)
  }

  @Test
  fun counterRowIsDoneAtItsTarget() {
    val model = TodayRules.buildToday(
      emptyList(),
      { _, _ -> DayFacts.EMPTY },
      listOf(
        CounterInput("k", "Water", CounterRules(listOf(1.0), 8), 8.0),
        CounterInput("n", "Coffee", CounterRules(listOf(1.0), null), 50.0),
      ),
      emptyList(),
      monday,
      0,
    )
    // One section only: no heading.
    assertEquals(listOf("counter:k", "counter:n"), model.rows.map { it.key })
    assertEquals(listOf(true, false), model.rows.map { (it as WidgetRow.Counter).done })
  }

  @Test
  fun noTodosLabelWhenTodosStandAlone() {
    val model = TodayRules.buildToday(
      emptyList(),
      { _, _ -> DayFacts.EMPTY },
      emptyList(),
      listOf(TodoInput("t", "One", null, 0)),
      monday,
      0,
    )
    assertEquals(listOf("todo:t"), model.rows.map { it.key })
  }

  @Test
  fun timerSessionMetaMatchesTheProtocol() {
    val end = Instant.parse("2026-11-16T08:15:00Z")
    assertEquals(
      """{"source":"timer_session","startedAt":"2026-11-16T08:00:00.000Z","endedAt":"2026-11-16T08:15:00.000Z","durationSeconds":900}""",
      TodayRules.timerSessionMetaJson(end.minusSeconds(900), end, 900),
    )
  }

  @Test
  fun runningTimerKeepsItsRowAndIsNotCountedTwice() {
    val hidden = HabitInput(
      "h",
      "Hidden",
      habit("""{"trackingMode":"timer","visibleOnlyInTimeRange":true,"timeRange":{"start":"06:00","end":"07:00"}}"""),
    )
    val notToday = HabitInput(
      "n",
      "Not today",
      habit("""{"trackingMode":"timer","schedule":{"type":"weekdays","days":[0]}}"""),
    )
    val idle = HabitInput("i", "Idle", habit("""{"trackingMode":"timer"}"""))
    val none = TodayRules.buildToday(listOf(hidden, notToday, idle), { _, _ -> DayFacts.EMPTY }, emptyList(), emptyList(), monday, 12 * 60)
    assertEquals(listOf("habit:i"), none.rows.map { it.key })

    val model = TodayRules.buildToday(
      listOf(hidden, notToday, idle),
      { _, _ -> DayFacts.EMPTY },
      emptyList(),
      emptyList(),
      monday,
      12 * 60,
      runningTimers = mapOf("h" to RunningTimer(1000L, "2026-11-16"), "n" to RunningTimer(2000L, "2026-11-16")),
    )
    // What is running comes first, under its own heading.
    assertEquals(listOf("label:now", "habit:h", "habit:n", "habit:i"), model.rows.map { it.key })
    val rows = model.rows.filterIsInstance<WidgetRow.Habit>().associateBy { it.id }
    assertEquals(1000L, rows.getValue("h").runningSinceMs)
    assertEquals(2000L, rows.getValue("n").runningSinceMs)
    assertNull(rows.getValue("i").runningSinceMs)
    // Only the idle habit is due today; a running timer does not make a habit due.
    assertEquals(1, model.due)
  }

  @Test
  fun everyTimerHabitCanRunInTheWidget() {
    val track = HabitInput(
      "t",
      "Breathing",
      habit("""{"trackingMode":"timer","timerSound":{"trackId":"wimhofMorning","playbackMode":"play_once"}}"""),
    )
    val plain = HabitInput("p", "Reading", habit("""{"trackingMode":"timer"}"""))
    val tick = HabitInput("b", "No Smoking", habit("{}"))
    val model = TodayRules.buildToday(listOf(track, plain, tick), { _, _ -> DayFacts.EMPTY }, emptyList(), emptyList(), monday, 0)
    val rows = model.rows.filterIsInstance<WidgetRow.Habit>().associateBy { it.id }
    // A track habit runs through the widget's player.
    assertTrue(rows.getValue("t").canRun)
    assertTrue(rows.getValue("t").hasAudio)
    assertTrue(rows.getValue("p").canRun)
    assertFalse(rows.getValue("p").hasAudio)
    assertFalse(rows.getValue("b").canRun)
  }

  @Test
  fun widgetTimersRoundTrip() {
    // The exact text the app must be able to read: __tests__/widgetTimerSessions.test.ts
    // parses this same string. Change both together.
    val written = """{"habit-1":{"startedAt":"2026-11-16T08:00:00.000Z","calendarDate":"2026-11-16"}}"""
    val timers = mapOf("habit-1" to RunningTimer(Instant.parse("2026-11-16T08:00:00Z").toEpochMilli(), "2026-11-16"))
    assertEquals(written, TodayRules.widgetTimersJson(timers))
    assertEquals(timers, TodayRules.parseWidgetTimers(written))
    assertEquals(emptyMap<String, RunningTimer>(), TodayRules.parseWidgetTimers(null))
    assertEquals(emptyMap<String, RunningTimer>(), TodayRules.parseWidgetTimers("{not json"))
    assertEquals(emptyMap<String, RunningTimer>(), TodayRules.parseWidgetTimers("""{"h":{"startedAt":"yesterday"}}"""))
  }

  @Test
  fun readsTheAppsRunningTimers() {
    val start = Instant.parse("2026-11-16T08:00:00Z").toEpochMilli()
    val json = """{
      "run":{"startedAt":"2026-11-16T08:00:00.000Z","pausedAt":null,"pauseOffsetMs":60000,"calendarDate":"2026-11-16"},
      "hold":{"startedAt":"2026-11-16T08:00:00.000Z","pausedAt":"2026-11-16T08:10:00.000Z","pauseOffsetMs":0,"calendarDate":"2026-11-16"},
      "bad":{"startedAt":7}
    }"""
    assertEquals(
      mapOf(
        "run" to AppTimer(start, null, 60_000),
        "hold" to AppTimer(start, start + 600_000, 0),
      ),
      TodayRules.parseAppTimers(json),
    )
    assertEquals(emptyMap<String, AppTimer>(), TodayRules.parseAppTimers(null))
  }

  @Test
  fun aTimerRunningInTheAppLocksTheWidgetRow() {
    val start = 1_000_000L
    val reading = HabitInput("r", "Reading", habit("""{"trackingMode":"timer"}"""))
    val study = HabitInput("s", "Study", habit("""{"trackingMode":"timer"}"""))
    val model = TodayRules.buildToday(
      listOf(reading, study),
      { _, _ -> DayFacts.EMPTY },
      emptyList(),
      emptyList(),
      monday,
      0,
      runningTimers = mapOf("r" to RunningTimer(5L, "2026-11-16")),
      appTimers = mapOf(
        "r" to AppTimer(start, null, 60_000),
        "s" to AppTimer(start, start + 600_000, 120_000),
      ),
    )
    // Running in the app is "now"; paused in the app stays in the list, so an
    // old forgotten session does not sit at the top for days.
    assertEquals(listOf("label:now", "habit:r", "habit:s"), model.rows.map { it.key })
    val rows = model.rows.filterIsInstance<WidgetRow.Habit>().associateBy { it.id }
    // The app's timer wins the display; time spent paused is not counted.
    val r = rows.getValue("r")
    assertTrue(r.inApp)
    assertEquals(start + 60_000, r.runningSinceMs)
    assertNull(r.pausedElapsedMs)
    val s = rows.getValue("s")
    assertTrue(s.inApp)
    assertEquals(480_000L, s.pausedElapsedMs)
  }

  private val trackOnly = """{"trackingMode":"timer","timerSound":{"trackId":"wimhofMorning","playbackMode":"play_once"}}"""
  private val looped = """{"trackingMode":"timer","timerSound":{"trackId":"meditation15min"}}"""

  @Test
  fun parsesTheTimerSound() {
    assertEquals("wimhofMorning", habit(trackOnly).soundTrackId)
    assertFalse(habit(trackOnly).soundLoops)
    assertEquals("meditation15min", habit(looped).soundTrackId)
    assertTrue(habit(looped).soundLoops)
    // An id the app does not bundle is no sound at all, as in hasHabitTimerSound.
    assertNull(habit("""{"trackingMode":"timer","timerSound":{"trackId":"gone"}}""").soundTrackId)
    assertNull(habit("""{"timerSound":{"trackId":"meditation15min"}}""").soundTrackId)
  }

  @Test
  fun elapsedLeavesOutPausedTime() {
    assertEquals(600_000L, TodayRules.timerElapsedMs(RunningTimer(0, "d"), 600_000))
    assertEquals(540_000L, TodayRules.timerElapsedMs(RunningTimer(0, "d", null, 60_000), 600_000))
    // Paused at 5 min: the clock stays there however late it is.
    assertEquals(300_000L, TodayRules.timerElapsedMs(RunningTimer(0, "d", 300_000, 0), 900_000))
    assertEquals(0L, TodayRules.timerElapsedMs(RunningTimer(1000, "d"), 0))
  }

  @Test
  fun stopwatchTapStartsThenStopsAndLogs() {
    val rules = habit("""{"trackingMode":"timer"}""")
    val started = TodayRules.applyTimerAction(rules, null, TimerAction.TOGGLE, 1_000, "2026-11-16", lockedByApp = false)
    assertEquals(RunningTimer(1_000, "2026-11-16"), started.session)
    assertNull(started.log)
    assertEquals(PlayerCommand.None, started.player)

    val stopped = TodayRules.applyTimerAction(rules, started.session, TimerAction.TOGGLE, 601_000, "2026-11-17", lockedByApp = false)
    assertNull(stopped.session)
    assertEquals(TimerLog(started.session!!, 601_000, 600, trackCompleted = false), stopped.log)

    // Under five seconds is a mistap: the stopwatch goes, nothing is logged.
    val mistap = TodayRules.applyTimerAction(rules, started.session, TimerAction.TOGGLE, 4_000, "2026-11-16", lockedByApp = false)
    assertNull(mistap.session)
    assertNull(mistap.log)
  }

  @Test
  fun aTimerTheAppRunsCannotBeStartedHere() {
    val rules = habit("""{"trackingMode":"timer"}""")
    val outcome = TodayRules.applyTimerAction(rules, null, TimerAction.TOGGLE, 1_000, "2026-11-16", lockedByApp = true)
    assertNull(outcome.session)
    // No session starts. The player is still told to stop, which it only acts on
    // if this habit's sound is playing — see stopSilencesTheHabitWhateverTheDatabaseSaysNow.
    assertEquals(PlayerCommand.Stop, outcome.player)
  }

  @Test
  fun trackTapPlaysPausesAndResumes() {
    val rules = habit(trackOnly)
    val started = TodayRules.applyTimerAction(rules, null, TimerAction.TOGGLE, 0, "2026-11-16", lockedByApp = false)
    assertEquals(PlayerCommand.Play("wimhofMorning", loop = false, positionMs = 0), started.player)

    val paused = TodayRules.applyTimerAction(rules, started.session, TimerAction.TOGGLE, 300_000, "2026-11-16", lockedByApp = false)
    assertEquals(RunningTimer(0, "2026-11-16", 300_000, 0), paused.session)
    assertEquals(PlayerCommand.Pause, paused.player)
    assertNull(paused.log)

    // Resumed a minute later: that minute is not counted, and the track picks up where it was.
    val resumed = TodayRules.applyTimerAction(rules, paused.session, TimerAction.TOGGLE, 360_000, "2026-11-16", lockedByApp = false)
    assertEquals(RunningTimer(0, "2026-11-16", null, 60_000), resumed.session)
    assertEquals(PlayerCommand.Play("wimhofMorning", loop = false, positionMs = 300_000), resumed.player)

    // PAUSE (a phone call took the audio) never resumes.
    val again = TodayRules.applyTimerAction(rules, paused.session, TimerAction.PAUSE, 400_000, "2026-11-16", lockedByApp = false)
    assertEquals(paused.session, again.session)
    assertEquals(PlayerCommand.None, again.player)
  }

  @Test
  fun trackEndCompletesAndStopDoesNot() {
    val rules = habit(trackOnly)
    val session = RunningTimer(0, "2026-11-16")
    val ended = TodayRules.applyTimerAction(rules, session, TimerAction.TRACK_ENDED, 1_340_000, "2026-11-16", lockedByApp = false)
    assertNull(ended.session)
    assertEquals(TimerLog(session, 1_340_000, 1340, trackCompleted = true), ended.log)
    assertEquals(PlayerCommand.Stop, ended.player)

    val stopped = TodayRules.applyTimerAction(rules, session, TimerAction.STOP, 700_000, "2026-11-16", lockedByApp = false)
    assertEquals(TimerLog(session, 700_000, 700, trackCompleted = false), stopped.log)
    assertEquals(PlayerCommand.Stop, stopped.player)

    // A looping sound ending is not a completed track.
    val loopEnd = TodayRules.applyTimerAction(habit(looped), session, TimerAction.TRACK_ENDED, 700_000, "2026-11-16", lockedByApp = false)
    assertFalse(loopEnd.log!!.trackCompleted)
  }

  /**
   * The player is told to stop by habit, and only acts when that habit's sound
   * is the one playing — so a Stop costs nothing when nothing is playing. The
   * state that must never decide it is the database: a sound outlives the timer
   * row (Clear activity, an import) and outlives the habit's sound setting, and
   * in both cases the Stop button was the only way left to silence it.
   */
  /**
   * Before a timer habit is started there is nothing to report, and "00:00 /
   * 15:00" under every untouched row is ten identical zeroes competing with the
   * one habit actually under way. The goal alone says the same thing in half the
   * width, and the row keeps its figure the moment a second is logged.
   */
  @Test
  fun anUnstartedTimerShowsItsGoalRatherThanAZero() {
    // Marked as a goal, because "22:20" on its own reads as twenty past ten.
    assertEquals(TimerFigure("15:00", isGoal = true), TodayRules.timerFigure(0, 900, started = false))
    assertEquals(TimerFigure("1:00:00", isGoal = true), TodayRules.timerFigure(0, 3600, started = false))
    // A stopwatch has no goal, so it has nothing to say until it runs.
    assertNull(TodayRules.timerFigure(0, null, started = false))

    // Running, even at zero, is worth a clock — and a clock needs no label.
    assertEquals(TimerFigure("00:00 / 15:00", isGoal = false), TodayRules.timerFigure(0, 900, started = true))
    assertEquals(TimerFigure("00:00", isGoal = false), TodayRules.timerFigure(0, null, started = true))

    // Time logged earlier today counts as started, however the row was left.
    assertEquals(TimerFigure("03:20 / 15:00", isGoal = false), TodayRules.timerFigure(200, 900, started = false))
    assertEquals(TimerFigure("03:20", isGoal = false), TodayRules.timerFigure(200, null, started = false))
  }

  @Test
  fun stopSilencesTheHabitWhateverTheDatabaseSaysNow() {
    val rules = habit(trackOnly)
    val session = RunningTimer(0, "2026-11-16")

    // The timer row is gone (Clear activity) but the track is still playing.
    for (action in listOf(TimerAction.STOP, TimerAction.TRACK_ENDED, TimerAction.PAUSE)) {
      val outcome = TodayRules.applyTimerAction(rules, null, action, 700_000, "2026-11-16", lockedByApp = false)
      assertNull(outcome.session)
      assertNull(outcome.log)
      assertEquals("$action with no timer", PlayerCommand.Stop, outcome.player)
    }

    // The sound was taken off the habit while its timer ran.
    val soundless = habit("""{"trackingMode":"timer"}""")
    val stopped = TodayRules.applyTimerAction(soundless, session, TimerAction.STOP, 700_000, "2026-11-16", lockedByApp = false)
    assertEquals(PlayerCommand.Stop, stopped.player)
    assertEquals(TimerLog(session, 700_000, 700, trackCompleted = false), stopped.log)

    // A mistap still silences it, even though it logs nothing.
    val mistap = TodayRules.applyTimerAction(rules, session, TimerAction.STOP, 4_000, "2026-11-16", lockedByApp = false)
    assertNull(mistap.log)
    assertEquals(PlayerCommand.Stop, mistap.player)
  }

  @Test
  fun pausedSessionsRoundTripAndCompletedMetaMatchesTheProtocol() {
    val timers = mapOf("h" to RunningTimer(Instant.parse("2026-11-16T08:00:00Z").toEpochMilli(), "2026-11-16", Instant.parse("2026-11-16T08:05:00Z").toEpochMilli(), 60_000))
    val json = TodayRules.widgetTimersJson(timers)
    assertEquals(
      """{"h":{"startedAt":"2026-11-16T08:00:00.000Z","calendarDate":"2026-11-16","pausedAt":"2026-11-16T08:05:00.000Z","pauseOffsetMs":60000}}""",
      json,
    )
    assertEquals(timers, TodayRules.parseWidgetTimers(json))
    val end = Instant.parse("2026-11-16T08:15:00Z")
    assertEquals(
      """{"source":"timer_session","startedAt":"2026-11-16T08:00:00.000Z","endedAt":"2026-11-16T08:15:00.000Z","durationSeconds":900,"trackCompleted":true}""",
      TodayRules.timerSessionMetaJson(end.minusSeconds(900), end, 900, trackCompleted = true),
    )
  }

  @Test
  fun anySessionCountsCompletesBelowTheGoal() {
    val goal = habit("""{"trackingMode":"timer","dailyTargetSeconds":900,"anySessionCounts":true}""")
    assertTrue(TodayRules.isHabitDayComplete(goal, DayFacts(total = 120.0)))
    assertFalse(TodayRules.isHabitDayComplete(goal, DayFacts.EMPTY))
    val track = habit(
      """{"trackingMode":"timer","anySessionCounts":true,"timerSound":{"trackId":"wimhofMorning","playbackMode":"play_once"}}""",
    )
    assertTrue(TodayRules.isHabitDayComplete(track, DayFacts(total = 120.0)))
    // Means nothing on a tick habit.
    assertFalse(habit("""{"anySessionCounts":true}""").anySessionCounts)
  }

  @Test
  fun todosTickedTodayStayUnderDoneAndMoveTheHeader() {
    val model = TodayRules.buildToday(
      listOf(HabitInput("a", "Open", habit("{}"))),
      { _, _ -> DayFacts.EMPTY },
      emptyList(),
      listOf(TodoInput("t1", "One", null, 0), TodoInput("t2", "Two", null, 1)),
      monday,
      0,
      doneTodos = listOf(TodoInput("d1", "Ticked", null, 0), TodoInput("d2", "Also ticked", "2026-11-10", 1)),
    )
    // One habit, two open todos, two todos already ticked today.
    assertEquals(5, model.due)
    assertEquals(2, model.done)
    assertEquals(
      listOf("habit:a", "label:todos", "todo:t1", "todo:t2", "label:done", "todo:d1", "todo:d2"),
      model.rows.map { it.key },
    )
    val ticked = model.rows.filterIsInstance<WidgetRow.Todo>().filter { it.done }
    assertEquals(listOf("d1", "d2"), ticked.map { it.id })
    // A ticked todo no longer nags about its date.
    assertEquals(TodoDue.NONE, ticked[1].due)
  }

  @Test
  fun todoRowsSayWhenTheyAreDue() {
    val model = TodayRules.buildToday(
      emptyList(),
      { _, _ -> DayFacts.EMPTY },
      emptyList(),
      listOf(
        TodoInput("late", "Late", "2026-11-10", 0),
        TodoInput("today", "Today", "2026-11-16", 1),
        TodoInput("soon", "Soon", "2026-11-20", 2),
        TodoInput("any", "Any time", null, 3),
      ),
      monday,
      0,
    )
    val due = model.rows.filterIsInstance<WidgetRow.Todo>().associate { it.id to it.due }
    assertEquals(TodoDue.OVERDUE, due["late"])
    assertEquals(TodoDue.TODAY, due["today"])
    assertEquals(TodoDue.LATER, due["soon"])
    assertEquals(TodoDue.NONE, due["any"])
    assertEquals("2026-11-20", model.rows.filterIsInstance<WidgetRow.Todo>().first { it.id == "soon" }.dueDate)
  }

  @Test
  fun aTimerRowCarriesSecondsForItsClock() {
    val reading = HabitInput("r", "Reading", habit("""{"trackingMode":"timer","dailyTargetSeconds":3600}"""))
    val track = HabitInput(
      "t",
      "Breathing",
      habit("""{"trackingMode":"timer","timerSound":{"trackId":"wimhofMorning","playbackMode":"play_once"}}"""),
    )
    val facts = { id: String, _: LocalDate -> if (id == "r") DayFacts(total = 609.0) else DayFacts.EMPTY }
    val now = 10_000_000L
    val model = TodayRules.buildToday(
      listOf(reading, track), facts, emptyList(), emptyList(), monday, 0,
      // Started 12.5 minutes ago, 2 of them paused.
      runningTimers = mapOf("r" to RunningTimer(now - 750_000, "2026-11-16", null, 120_000)),
    )
    val rows = model.rows.filterIsInstance<WidgetRow.Habit>().associateBy { it.id }
    val row = rows.getValue("r")
    assertEquals(609, row.loggedSeconds)
    assertEquals(3600, row.targetSeconds)
    assertEquals(now - 750_000, row.startedAtMs)
    assertEquals(now - 630_000, row.runningSinceMs)
    // A play-once track is its own goal.
    assertEquals(1340, rows.getValue("t").targetSeconds)
  }

  @Test
  fun clockTextMatchesTheChronometer() {
    assertEquals("00:00", TodayRules.formatElapsed(0))
    assertEquals("05:09", TodayRules.formatElapsed(309))
    assertEquals("59:59", TodayRules.formatElapsed(3599))
    assertEquals("1:00:00", TodayRules.formatElapsed(3600))
    assertEquals("1:30:05", TodayRules.formatElapsed(5405))
  }

  @Test
  fun writesValuesTheAppAccepts() {
    assertEquals("2026-11-16T08:05:03.007Z", TodayRules.isoTimestamp(Instant.parse("2026-11-16T08:05:03.007Z")))
    assertEquals("2026-11-16T08:05:03.000Z", TodayRules.isoTimestamp(Instant.parse("2026-11-16T08:05:03Z")))
    assertEquals("""{"source":"quick_button","increment":5}""", TodayRules.counterMetaJson(5.0))
    assertEquals("""{"source":"quick_button","increment":0.5}""", TodayRules.counterMetaJson(0.5))
    assertEquals("0.0001", TodayRules.formatNumber(0.0001))
  }

  @Test
  fun miniJsonParsesNestedValues() {
    val parsed = MiniJson.parse("""{"a":[1,2.5,-3e2],"b":{"c":"x\"é"},"d":true,"e":null}""")
    @Suppress("UNCHECKED_CAST")
    val map = parsed as Map<String, Any?>
    assertEquals(listOf(1.0, 2.5, -300.0), map["a"])
    assertEquals("x\"é", (map["b"] as Map<*, *>)["c"])
    assertEquals(true, map["d"])
    assertTrue(map.containsKey("e"))
    assertNull(MiniJson.parseObjectOrNull("{broken"))
  }

  // ---- shared fixture with the TypeScript side -----------------------------

  private fun findFixture(): File? {
    val starts = listOfNotNull(System.getProperty("lifewidget.projectDir"), System.getProperty("user.dir"))
    for (start in starts) {
      var dir: File? = File(start).absoluteFile
      var depth = 0
      while (dir != null && depth < 8) {
        val candidate = File(dir, "__tests__/fixtures/dayRules.json")
        if (candidate.isFile) return candidate
        dir = dir.parentFile
        depth++
      }
    }
    return null
  }

  @Test
  fun matchesSharedDayRulesFixture() {
    val file = findFixture()
    assumeTrue("__tests__/fixtures/dayRules.json not found; skipping", file != null)
    val cases = MiniJson.parse(file!!.readText(Charsets.UTF_8)) as List<*>
    assertTrue(cases.isNotEmpty())
    val failures = ArrayList<String>()
    for (raw in cases) {
      val case = raw as Map<*, *>
      val name = case["name"] as? String ?: "?"
      val kind = case["kind"] as? String
      @Suppress("UNCHECKED_CAST")
      val config = (case["config"] as? Map<String, Any?>) ?: emptyMap()
      val today = LocalDate.parse(case["today"] as String)
      val days = (case["days"] as? Map<*, *>) ?: emptyMap<String, Any?>()
      val facts = { date: LocalDate ->
        val day = days[date.toString()] as? Map<*, *>
        if (day == null) {
          DayFacts.EMPTY
        } else {
          DayFacts(total = (day["total"] as? Double) ?: 0.0, hasSkip = day["skipped"] == true)
        }
      }
      val expect = case["expect"] as Map<*, *>

      when (kind) {
        "habit" -> {
          val rules = TodayRules.parseHabitConfig(config)
          if (rules == null) {
            failures.add("$name: config did not parse")
            continue
          }
          val state = TodayRules.habitDayState(rules, today, facts)
          check(failures, name, "dueToday", expect["dueToday"], state.due)
          check(failures, name, "doneToday", expect["doneToday"], state.done)
          check(failures, name, "skippedToday", expect["skippedToday"], state.skipped)
        }
        "counter" -> {
          val rules = TodayRules.parseCounterConfig(config)
          if (rules == null) {
            failures.add("$name: config did not parse")
            continue
          }
          check(failures, name, "doneToday", expect["doneToday"], TodayRules.isCounterDayComplete(rules, facts(today).total))
          check(
            failures, name, "skippedToday", expect["skippedToday"],
            TodayRules.isCounterDaySkipped(rules, facts(today).total, facts(today).hasSkip),
          )
        }
        else -> failures.add("$name: unknown kind $kind")
      }
    }
    assertTrue(failures.joinToString("\n"), failures.isEmpty())
  }

  private fun check(failures: MutableList<String>, name: String, field: String, expected: Any?, actual: Boolean) {
    if (expected == null) return
    if (expected != actual) failures.add("$name: $field expected $expected, got $actual")
  }

  @Test
  fun fixtureFinderDoesNotThrow() {
    // Keeps the finder exercised even when the fixture is absent.
    val found = findFixture()
    if (found != null) assertNotNull(found.parentFile)
  }
}
