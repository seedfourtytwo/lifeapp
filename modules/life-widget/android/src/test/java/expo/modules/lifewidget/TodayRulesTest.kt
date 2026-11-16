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
    assertEquals(
      listOf(
        "label:habits", "habit:a",
        "label:counters", "counter:k",
        "label:todos", "todo:t2", "todo:t1",
        "label:done", "habit:b", "habit:c",
      ),
      model.rows.map { it.key },
    )
    // Due: a, b and the targeted counter. Done: b.
    assertEquals(3, model.due)
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
  fun timerQuickMinutesScaleWithTheGoal() {
    assertEquals(listOf(5, 15), TodayRules.timerQuickMinutes(null))
    assertEquals(listOf(5, 15), TodayRules.timerQuickMinutes(30))
    assertEquals(listOf(15, 30), TodayRules.timerQuickMinutes(31))
    assertEquals(listOf(15, 30), TodayRules.timerQuickMinutes(90))
  }

  @Test
  fun timerRowsOfferQuickLogUnlessATrackMustFinish() {
    val plain = HabitInput("p", "Reading", habit("""{"trackingMode":"timer","dailyTargetSeconds":3600}"""))
    val track = HabitInput(
      "t",
      "Meditation",
      habit("""{"trackingMode":"timer","timerSound":{"trackId":"meditation15min","playbackMode":"play_once"}}"""),
    )
    val trackWithGoal = HabitInput(
      "g",
      "Breathing",
      habit(
        """{"trackingMode":"timer","dailyTargetSeconds":1200,"timerSound":{"trackId":"wimhofMorning","playbackMode":"play_once"}}""",
      ),
    )
    val model = TodayRules.buildToday(
      listOf(plain, track, trackWithGoal),
      { _: String, _: LocalDate -> DayFacts.EMPTY },
      emptyList(),
      emptyList(),
      monday,
      12 * 60,
    )
    val byId = model.rows.filterIsInstance<WidgetRow.Habit>().associateBy { it.id }
    assertEquals(listOf(15, 30), byId.getValue("p").quickMinutes)
    assertEquals(emptyList<Int>(), byId.getValue("t").quickMinutes)
    assertEquals(listOf(5, 15), byId.getValue("g").quickMinutes)
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
    assertEquals(listOf("habit:h", "habit:n", "habit:i"), model.rows.map { it.key })
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
    // A track habit runs through the widget's player; it still has no quick-log buttons.
    assertTrue(rows.getValue("t").canRun)
    assertTrue(rows.getValue("t").hasAudio)
    assertEquals(emptyList<Int>(), rows.getValue("t").quickMinutes)
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
    assertEquals(PlayerCommand.None, outcome.player)
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
