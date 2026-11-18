package expo.modules.lifewidget

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/*
 * The "Today" rules, in pure Kotlin (java.* only, no android.*), so they run in
 * plain JVM unit tests against the fixture the TypeScript side shares.
 *
 * Every rule here mirrors a TypeScript one; the source is named beside it. When
 * the TypeScript changes, this file has to change with it.
 */

/** `HabitScheduleSchema` (src/protocol/schedule.ts). Weekday numbers are JS `getDay()`: 0 = Sunday. */
sealed class Schedule {
  object Daily : Schedule()
  data class Weekdays(val days: Set<Int>) : Schedule()
  data class EveryNDays(val interval: Int, val anchor: LocalDate) : Schedule()
  /** Week = Monday..Sunday, local calendar. */
  data class TimesPerWeek(val times: Int) : Schedule()
}

/** The parts of `HabitConfig` the widget needs. */
data class HabitRules(
  val timer: Boolean,
  val schedule: Schedule,
  /** Minutes after midnight, or null when the habit has no time range. */
  val timeRangeStart: Int? = null,
  val timeRangeEnd: Int? = null,
  val visibleOnlyInTimeRange: Boolean = false,
  val dailyTargetSeconds: Int? = null,
  /**
   * Set only for a timer habit with a bundled play_once track: its length in
   * seconds. Without `dailyTargetSeconds`, such a day is complete only when a
   * session finished the track (`trackCompleted`), never on logged seconds.
   */
  val playOnceTrackSeconds: Int? = null,
  /** `anySessionCounts`: any logged time completes the day, whatever the goal or track. */
  val anySessionCounts: Boolean = false,
  /** The habit's bundled timer sound (`hasHabitTimerSound`), or null. */
  val soundTrackId: String? = null,
  /** `getHabitTimerPlaybackMode`: loop unless the habit says play_once. */
  val soundLoops: Boolean = true,
)

/** The parts of `CounterConfig` the widget needs. */
data class CounterRules(
  val quickIncrements: List<Double>,
  val dailyTarget: Int? = null,
)

/** One element's events on one day, reduced to what the rules read. */
data class DayFacts(
  /** SUM(value) over the day's rows. Skip rows carry value 0. */
  val total: Double = 0.0,
  /** The day has a `{"source":"skip"}` row. */
  val hasSkip: Boolean = false,
  /** Some `timer_session` row on the day has `trackCompleted: true`. */
  val trackCompleted: Boolean = false,
) {
  companion object {
    val EMPTY = DayFacts()
  }
}

data class HabitDayState(
  /** Due by schedule alone, before a skip is taken into account. */
  val scheduled: Boolean,
  /** Due today: scheduled and not skipped. */
  val due: Boolean,
  val done: Boolean,
  val skipped: Boolean,
)

enum class HabitRowState { OPEN, DONE, SKIPPED }

/** Where an open todo's date stands against today. */
enum class TodoDue { NONE, OVERDUE, TODAY, LATER }

/**
 * A timer the widget is running, in the shape of the app's `ActiveTimerSession`:
 * when it started, the local day it belongs to, and its pauses.
 */
data class RunningTimer(
  val startedAtMs: Long,
  val date: String,
  val pausedAtMs: Long? = null,
  val pauseOffsetMs: Long = 0,
)

/** What a tap, a notification button or the player asks of a habit's timer. */
enum class TimerAction {
  /** The row: start; then stop (stopwatch) or pause/resume (a habit with a sound). */
  TOGGLE,
  /** Pause only — the audio was taken away (a call, headphones unplugged). */
  PAUSE,
  STOP,
  /** The player reached the end of a play-once track. */
  TRACK_ENDED,
}

/** What the audio player should do after a timer action. */
sealed class PlayerCommand {
  object None : PlayerCommand()
  data class Play(val trackId: String, val loop: Boolean, val positionMs: Long) : PlayerCommand()
  object Pause : PlayerCommand()
  /** Stop this habit's sound. */
  object Stop : PlayerCommand()
  /** Stop whatever is playing: another habit's timer took over without a sound of its own. */
  object StopAll : PlayerCommand()
}

/** What a timer habit's row says under its name, and whether it is a goal. */
data class TimerFigure(val text: String, val isGoal: Boolean)

/** A finished session to write as a `timer_session` event. */
data class TimerLog(val timer: RunningTimer, val endedAtMs: Long, val seconds: Int, val trackCompleted: Boolean)

data class TimerOutcome(
  /** The habit's timer after the action; null when none is running. */
  val session: RunningTimer?,
  val log: TimerLog?,
  val player: PlayerCommand,
)

/** A timer running in the app (`ActiveTimerSessionSchema`), reduced to what a clock needs. */
data class AppTimer(val startedAtMs: Long, val pausedAtMs: Long?, val pauseOffsetMs: Long)

/**
 * The headings the list can carry, in display order. NOW holds the habits whose
 * timer the widget is running or holding paused, or the app is running; DONE
 * holds done and skipped habits. The day's open habits and counters run between
 * them as one list under no heading at all.
 */
enum class Section { NOW, TODOS, DONE }

sealed class WidgetRow {
  abstract val key: String

  data class Habit(
    val id: String,
    val name: String,
    val state: HabitRowState,
    val timer: Boolean,
    /** Timer habits: seconds logged today, the running session not included. */
    val loggedSeconds: Int = 0,
    /** Timer habits: goal in seconds — the daily target, else a play-once track's length. */
    val targetSeconds: Int? = null,
    /** Timer habits: a tap on the row starts the widget's timer. */
    val canRun: Boolean = false,
    /** The timer plays a sound: a tap on a running row pauses, and the row has a stop button. */
    val hasAudio: Boolean = false,
    /**
     * Wall-clock start (epoch ms) of the timer running on this habit, or null.
     * For an app timer, moved forward by the time it has spent paused.
     */
    val runningSinceMs: Long? = null,
    /** When the running timer was started (epoch ms), pauses not taken out. */
    val startedAtMs: Long? = null,
    /** Set while the timer is paused: the active time it shows, frozen. */
    val pausedElapsedMs: Long? = null,
    /** The running timer belongs to the app: the widget shows it and leaves it alone. */
    val inApp: Boolean = false,
  ) : WidgetRow() {
    override val key: String get() = "habit:$id"
  }

  data class Counter(
    val id: String,
    val name: String,
    val total: Double,
    val target: Int?,
    /** At most two, from `quickIncrements`. */
    val increments: List<Double>,
    /** Has a target and reached it. */
    val done: Boolean = false,
  ) : WidgetRow() {
    override val key: String get() = "counter:$id"
  }

  data class Todo(
    val id: String,
    val title: String,
    val due: TodoDue = TodoDue.NONE,
    /** `YYYY-MM-DD`, set with [TodoDue.LATER] and [TodoDue.OVERDUE]. */
    val dueDate: String? = null,
    /** Ticked today: listed under Done, where a tap reopens it. */
    val done: Boolean = false,
  ) : WidgetRow() {
    override val key: String get() = "todo:$id"
  }

  /** A section heading. Present only when the widget shows more than one section. */
  data class Label(val section: Section) : WidgetRow() {
    override val key: String get() = "label:${section.name.lowercase(Locale.ROOT)}"
  }
}

data class HabitInput(val id: String, val name: String, val rules: HabitRules)

data class CounterInput(
  val id: String,
  val name: String,
  val rules: CounterRules,
  val todayTotal: Double,
  val skippedRowToday: Boolean = false,
)

data class TodoInput(val id: String, val title: String, val dueDate: String?, val sortOrder: Long)

/** An element as it comes out of SQL, before dashboard ordering. */
data class OrderableElement<T>(val value: T, val createdAt: String, val sortOrder: Long?)

data class TodayModel(
  val rows: List<WidgetRow>,
  /** Header figures: done of due — habits, counters that have a target, and today's todos. */
  val done: Int,
  val due: Int,
)

object TodayRules {
  const val MAX_TODOS = 5

  /** `BUNDLED_HABIT_SOUND_CATALOG` (src/protocol/habitSoundCatalog.ts): id → duration seconds. */
  val BUNDLED_TRACK_SECONDS: Map<String, Int> = mapOf(
    "meditation15min" to 915,
    "meditation30min" to 1851,
    "wimhofMorning" to 1340,
    "wimhofEvening" to 935,
  )

  // ---- config parsing (mirrors the Zod schemas, defaults included) ----------

  /** `HabitConfigSchema`. Null when the config would not parse in the app either. */
  fun parseHabitConfig(config: Map<String, Any?>): HabitRules? {
    val mode = config["trackingMode"] ?: "boolean"
    if (mode != "boolean" && mode != "timer") return null
    val timer = mode == "timer"

    val schedule = parseSchedule(config["schedule"]) ?: return null

    var start: Int? = null
    var end: Int? = null
    val range = config["timeRange"]
    if (range is Map<*, *>) {
      start = parseHHmm(range["start"]) ?: return null
      end = parseHHmm(range["end"]) ?: return null
    } else if (range != null) {
      return null
    }

    val visibleOnly = config["visibleOnlyInTimeRange"] == true
    val target = positiveInt(config["dailyTargetSeconds"])

    var playOnce: Int? = null
    var soundTrackId: String? = null
    var soundLoops = true
    val sound = config["timerSound"]
    if (timer && sound is Map<*, *>) {
      val trackId = (sound["trackId"] as? String)?.trim()
      val playback = sound["playbackMode"] ?: "loop"
      if (trackId != null && BUNDLED_TRACK_SECONDS.containsKey(trackId)) {
        soundTrackId = trackId
        soundLoops = playback != "play_once"
        if (!soundLoops) playOnce = BUNDLED_TRACK_SECONDS[trackId]
      }
    }

    return HabitRules(
      timer = timer,
      schedule = schedule,
      timeRangeStart = start,
      timeRangeEnd = end,
      visibleOnlyInTimeRange = visibleOnly,
      dailyTargetSeconds = target,
      playOnceTrackSeconds = playOnce,
      anySessionCounts = timer && config["anySessionCounts"] == true,
      soundTrackId = soundTrackId,
      soundLoops = soundLoops,
    )
  }

  fun parseSchedule(raw: Any?): Schedule? {
    if (raw == null) return Schedule.Daily
    if (raw !is Map<*, *>) return null
    return when (raw["type"]) {
      "daily" -> Schedule.Daily
      "weekdays" -> {
        val days = raw["days"] as? List<*> ?: return null
        val set = HashSet<Int>()
        for (d in days) {
          val n = wholeNumber(d) ?: return null
          if (n < 0 || n > 6) return null
          set.add(n)
        }
        if (set.isEmpty()) null else Schedule.Weekdays(set)
      }
      "every_n_days" -> {
        val interval = wholeNumber(raw["interval"]) ?: return null
        if (interval < 1) return null
        val anchor = parseDate(raw["anchorDate"]) ?: return null
        Schedule.EveryNDays(interval, anchor)
      }
      "times_per_week" -> {
        val times = wholeNumber(raw["times"]) ?: return null
        if (times < 1 || times > 6) return null
        Schedule.TimesPerWeek(times)
      }
      else -> null
    }
  }

  /** `CounterConfigSchema`. */
  fun parseCounterConfig(config: Map<String, Any?>): CounterRules? {
    val raw = config["quickIncrements"] as? List<*> ?: return null
    val increments = ArrayList<Double>()
    for (value in raw) {
      val n = value as? Double ?: return null
      if (n <= 0.0 || n.isNaN() || n.isInfinite()) return null
      increments.add(n)
    }
    if (increments.isEmpty()) return null
    return CounterRules(increments, positiveInt(config["dailyTarget"]))
  }

  private fun wholeNumber(value: Any?): Int? {
    val d = value as? Double ?: return null
    if (d != Math.rint(d) || d > Int.MAX_VALUE || d < Int.MIN_VALUE) return null
    return d.toInt()
  }

  private fun positiveInt(value: Any?): Int? {
    val n = wholeNumber(value) ?: return null
    return if (n > 0) n else null
  }

  private val DATE_RE = Regex("""^\d{4}-\d{2}-\d{2}$""")
  private val HHMM_RE = Regex("""^([01]\d|2[0-3]):([0-5]\d)$""")

  fun parseDate(value: Any?): LocalDate? {
    val s = value as? String ?: return null
    if (!DATE_RE.matches(s)) return null
    return try {
      LocalDate.parse(s)
    } catch (e: java.time.format.DateTimeParseException) {
      null
    }
  }

  fun parseHHmm(value: Any?): Int? {
    val s = value as? String ?: return null
    val match = HHMM_RE.matchEntire(s) ?: return null
    return match.groupValues[1].toInt() * 60 + match.groupValues[2].toInt()
  }

  // ---- day rules -------------------------------------------------------------

  /** `isHabitDayComplete` (src/protocol/kinds/habit.ts). */
  fun isHabitDayComplete(rules: HabitRules, facts: DayFacts): Boolean {
    if (rules.timer) {
      if (rules.anySessionCounts) return facts.total > 0
      val target = rules.dailyTargetSeconds
      if (target != null && target > 0) return facts.total >= target
      if (rules.playOnceTrackSeconds != null) return facts.trackCompleted
      return facts.total > 0
    }
    return facts.total >= 1
  }

  /** `isElementDayComplete` for a counter (src/protocol/semantics.ts). */
  fun isCounterDayComplete(rules: CounterRules, total: Double): Boolean {
    // A counter without a target is never "complete" (decision shared with dayRules.ts).
    val target = rules.dailyTarget
    return target != null && target > 0 && total >= target
  }

  /** A targeted counter with a skip row that has not reached its target: not due today. */
  fun isCounterDaySkipped(rules: CounterRules, total: Double, hasSkip: Boolean): Boolean {
    val target = rules.dailyTarget
    return hasSkip && target != null && target > 0 && total < target
  }

  /** `isScheduleActiveOnDate` for the date-only variants (src/protocol/schedule.ts). */
  fun isScheduledOn(schedule: Schedule, date: LocalDate): Boolean = when (schedule) {
    is Schedule.Daily -> true
    is Schedule.Weekdays -> schedule.days.contains(date.dayOfWeek.value % 7)
    is Schedule.EveryNDays -> {
      val elapsed = ChronoUnit.DAYS.between(schedule.anchor, date)
      elapsed >= 0 && elapsed % schedule.interval == 0L
    }
    // Needs the week's history; see habitDayState.
    is Schedule.TimesPerWeek -> true
  }

  /** Monday of the local week that holds `date`. */
  fun weekStart(date: LocalDate): LocalDate = date.minusDays((date.dayOfWeek.value - 1).toLong())

  /**
   * Today's state for one habit. `facts` answers for any date from the start
   * of today's week through today (missing days are empty).
   *
   * - complete: the kind's completion rule on today's rows;
   * - skipped: today has a skip row and is not complete;
   * - scheduled: by schedule; times_per_week is scheduled while fewer than
   *   `times` days earlier this week were complete, or when today is complete;
   * - due: scheduled and not skipped.
   */
  fun habitDayState(rules: HabitRules, today: LocalDate, facts: (LocalDate) -> DayFacts): HabitDayState {
    val todayFacts = facts(today)
    val done = isHabitDayComplete(rules, todayFacts)
    val skipped = todayFacts.hasSkip && !done
    val schedule = rules.schedule
    val scheduled = if (schedule is Schedule.TimesPerWeek) {
      if (done) {
        true
      } else {
        var count = 0
        var day = weekStart(today)
        while (day.isBefore(today)) {
          if (isHabitDayComplete(rules, facts(day))) count++
          day = day.plusDays(1)
        }
        count < schedule.times
      }
    } else {
      isScheduledOn(schedule, today)
    }
    return HabitDayState(scheduled = scheduled, due = scheduled && !skipped, done = done, skipped = skipped)
  }

  /**
   * `shouldShowHabitOnHabitsPage` + `isWithinTimeRange` (src/utils/time.ts):
   * inclusive start, exclusive end, wraps past midnight.
   */
  fun isVisibleAt(rules: HabitRules, minuteOfDay: Int): Boolean {
    if (!rules.visibleOnlyInTimeRange) return true
    val start = rules.timeRangeStart ?: return true
    val end = rules.timeRangeEnd ?: return true
    return if (start <= end) {
      minuteOfDay >= start && minuteOfDay < end
    } else {
      minuteOfDay >= start || minuteOfDay < end
    }
  }

  /** The next minute today (strictly after `minuteOfDay`) at which some habit's window opens or closes. */
  fun nextWindowBoundary(habits: List<HabitInput>, minuteOfDay: Int): Int? {
    var best: Int? = null
    for (habit in habits) {
      val r = habit.rules
      if (!r.visibleOnlyInTimeRange) continue
      for (boundary in listOfNotNull(r.timeRangeStart, r.timeRangeEnd)) {
        if (boundary > minuteOfDay && (best == null || boundary < best)) best = boundary
      }
    }
    return best
  }

  // ---- ordering --------------------------------------------------------------

  /**
   * `sortActiveElements` (src/utils/dashboardElements.ts): elements with a
   * dashboard row by its sort_order, then the rest by created_at.
   */
  fun <T> sortByDashboard(elements: List<OrderableElement<T>>): List<T> {
    val sorted = elements.sortedWith(Comparator<OrderableElement<T>> { a, b ->
      val ao = a.sortOrder
      val bo = b.sortOrder
      when {
        ao != null && bo != null -> ao.compareTo(bo)
        ao != null -> -1
        bo != null -> 1
        else -> a.createdAt.compareTo(b.createdAt)
      }
    })
    return sorted.map { it.value }
  }

  /** `todoSection` index (src/protocol/todo.ts): overdue, today, later, undated. */
  fun todoSection(dueDate: String?, today: String): Int = when {
    dueDate == null -> 3
    dueDate < today -> 0
    dueDate == today -> 1
    else -> 2
  }

  /** `compareTodos`: section, then nearest deadline, then manual order. */
  fun sortTodos(todos: List<TodoInput>, today: String): List<TodoInput> =
    todos.sortedWith(Comparator<TodoInput> { a, b ->
      val section = todoSection(a.dueDate, today) - todoSection(b.dueDate, today)
      if (section != 0) return@Comparator section
      val ad = a.dueDate
      val bd = b.dueDate
      if (ad != null && bd != null && ad != bd) return@Comparator if (ad < bd) -1 else 1
      a.sortOrder.compareTo(b.sortOrder)
    })

  // ---- the list --------------------------------------------------------------

  /**
   * Everything the widget shows, in order:
   * what is running now, open due habits, counters, up to [MAX_TODOS] open
   * todos, then done and skipped habits and the todos ticked today. Each non-empty section gets a heading when there is more
   * than one of them.
   *
   * `habits` and `counters` arrive in dashboard order. A habit outside its
   * visibility window is left out entirely (and out of the header count), as
   * HabitsScreen does.
   */
  fun buildToday(
    habits: List<HabitInput>,
    habitFacts: (String, LocalDate) -> DayFacts,
    counters: List<CounterInput>,
    todos: List<TodoInput>,
    today: LocalDate,
    minuteOfDay: Int,
    /** Habit id → the timer the widget is running on it. */
    runningTimers: Map<String, RunningTimer> = emptyMap(),
    /** Habit id → the timer the app is running on it. Shown, never controlled, by the widget. */
    appTimers: Map<String, AppTimer> = emptyMap(),
    /** Todos completed today: listed under Done, and counted in the header. */
    doneTodos: List<TodoInput> = emptyList(),
  ): TodayModel {
    val now = ArrayList<WidgetRow>()
    val open = ArrayList<WidgetRow>()
    val counterRows = ArrayList<WidgetRow>()
    val settled = ArrayList<WidgetRow>()
    var due = 0
    var done = 0

    for (habit in habits) {
      // A running timer always keeps its row: without it there is nothing to stop it with.
      // The app's timer wins the display: the widget never controls it.
      val appTimer = appTimers[habit.id]
      val shown = appTimer?.let { RunningTimer(it.startedAtMs, "", it.pausedAtMs, it.pauseOffsetMs) }
        ?: runningTimers[habit.id]
      val runningSince = shown?.let { it.startedAtMs + it.pauseOffsetMs }
      val visible = isVisibleAt(habit.rules, minuteOfDay)
      if (!visible && runningSince == null) continue
      val state = habitDayState(habit.rules, today) { date -> habitFacts(habit.id, date) }
      val rowState = when {
        !visible -> null
        state.due && state.done -> HabitRowState.DONE
        state.due -> HabitRowState.OPEN
        state.skipped && state.scheduled -> HabitRowState.SKIPPED
        else -> null
      } ?: if (runningSince != null) HabitRowState.OPEN else continue

      if (visible && state.due) {
        due++
        if (state.done) done++
      }

      val row = if (habit.rules.timer) {
        val seconds = habitFacts(habit.id, today).total
        val target = habit.rules.dailyTargetSeconds ?: habit.rules.playOnceTrackSeconds
        WidgetRow.Habit(
          id = habit.id,
          name = habit.name,
          state = rowState,
          timer = true,
          loggedSeconds = seconds.toInt(),
          targetSeconds = target,
          canRun = true,
          hasAudio = habit.rules.soundTrackId != null,
          runningSinceMs = runningSince,
          startedAtMs = shown?.startedAtMs,
          pausedElapsedMs = shown?.pausedAtMs?.let { timerElapsedMs(shown, it) },
          inApp = appTimer != null,
        )
      } else {
        WidgetRow.Habit(id = habit.id, name = habit.name, state = rowState, timer = false)
      }
      val isNow = runningTimers.containsKey(habit.id) || (appTimer != null && appTimer.pausedAtMs == null)
      when {
        isNow -> now.add(row)
        rowState == HabitRowState.OPEN -> open.add(row)
        else -> settled.add(row)
      }
    }

    for (counter in counters) {
      val target = counter.rules.dailyTarget
      // A skipped counter is not due, so it leaves the header count; its row stays usable.
      val complete = isCounterDayComplete(counter.rules, counter.todayTotal)
      if (target != null && !isCounterDaySkipped(counter.rules, counter.todayTotal, counter.skippedRowToday)) {
        due++
        if (complete) done++
      }
      counterRows.add(
        WidgetRow.Counter(
          id = counter.id,
          name = counter.name,
          total = counter.todayTotal,
          target = target,
          increments = counter.rules.quickIncrements.take(2),
          done = complete,
        ),
      )
    }

    val todayKey = today.toString()
    val todoRows = sortTodos(todos, todayKey).take(MAX_TODOS).map {
      val dueDate = it.dueDate
      val due = when {
        dueDate == null -> TodoDue.NONE
        dueDate < todayKey -> TodoDue.OVERDUE
        dueDate == todayKey -> TodoDue.TODAY
        else -> TodoDue.LATER
      }
      WidgetRow.Todo(it.id, it.title, due, if (due == TodoDue.TODAY) null else dueDate)
    }
    due += todoRows.size + doneTodos.size
    done += doneTodos.size
    for (todo in doneTodos) settled.add(WidgetRow.Todo(todo.id, todo.title, done = true))

    // Habits and counters are the day itself, in the order the user put them in:
    // one run, under no heading. Naming them would cost two of the few rows the
    // widget has to say what the rows already say.
    val sections = listOf(
      Section.NOW to now,
      null to (open + counterRows),
      Section.TODOS to todoRows,
      Section.DONE to settled,
    ).filter { it.second.isNotEmpty() }
    val rows = if (sections.size > 1) {
      sections.flatMap { (section, sectionRows) ->
        (section?.let { listOf(WidgetRow.Label(it)) } ?: emptyList()) + sectionRows
      }
    } else {
      sections.flatMap { it.second }
    }
    return TodayModel(rows = rows, done = done, due = due)
  }

  // ---- values written to SQLite ---------------------------------------------

  private val ISO_MILLIS: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).withZone(ZoneOffset.UTC)

  /** `Date.prototype.toISOString()`: UTC, milliseconds, `Z`. */
  fun isoTimestamp(instant: Instant): String = ISO_MILLIS.format(instant)

  /**
   * A number as `JSON.stringify` / template literals print the common cases:
   * whole numbers without a decimal point, others in plain decimal form.
   */
  fun formatNumber(value: Double): String {
    if (value == Math.rint(value) && Math.abs(value) < 1e15) return value.toLong().toString()
    return java.math.BigDecimal(value.toString()).stripTrailingZeros().toPlainString()
  }

  /** Meta of a counter quick tap: `{ source: 'quick_button', increment }` (CounterWidget.tsx). */
  fun counterMetaJson(increment: Double): String =
    "{\"source\":\"quick_button\",\"increment\":${formatNumber(increment)}}"

  // ---- timers shared through app_settings ------------------------------------

  /** `ACTIVE_TIMER_SESSIONS_KEY` (activeTimerRepository.ts): written by the app only. */
  const val APP_TIMERS_KEY = "active_timer_sessions"

  /** `WIDGET_TIMER_SESSIONS_KEY` (activeTimerRepository.ts): written by the widget only. */
  const val WIDGET_TIMERS_KEY = "widget_timer_sessions"

  private fun parseInstantMs(value: Any?): Long? {
    val s = value as? String ?: return null
    return try {
      Instant.parse(s).toEpochMilli()
    } catch (e: java.time.format.DateTimeParseException) {
      null
    }
  }

  /** `WidgetTimerSessionSchema` records; anything malformed reads as no timers at all, as in the app. */
  fun parseWidgetTimers(json: String?): Map<String, RunningTimer> {
    val root = MiniJson.parseObjectOrNull(json) ?: return emptyMap()
    val result = LinkedHashMap<String, RunningTimer>()
    for ((id, raw) in root) {
      val entry = raw as? Map<*, *> ?: return emptyMap()
      val startedAt = parseInstantMs(entry["startedAt"]) ?: return emptyMap()
      val date = parseDate(entry["calendarDate"]) ?: return emptyMap()
      val pausedAt = entry["pausedAt"]?.let { parseInstantMs(it) ?: return emptyMap() }
      val offset = (entry["pauseOffsetMs"] ?: 0.0) as? Double ?: return emptyMap()
      if (offset < 0) return emptyMap()
      result[id] = RunningTimer(startedAt, date.toString(), pausedAt, offset.toLong())
    }
    return result
  }

  private fun jsonString(value: String): String =
    "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

  fun widgetTimersJson(timers: Map<String, RunningTimer>): String =
    timers.entries.joinToString(",", "{", "}") { (id, timer) ->
      val pause = (timer.pausedAtMs?.let { ",\"pausedAt\":\"${isoTimestamp(Instant.ofEpochMilli(it))}\"" } ?: "") +
        (if (timer.pauseOffsetMs > 0) ",\"pauseOffsetMs\":${timer.pauseOffsetMs}" else "")
      "${jsonString(id)}:{\"startedAt\":\"${isoTimestamp(Instant.ofEpochMilli(timer.startedAtMs))}\"," +
        "\"calendarDate\":${jsonString(timer.date)}$pause}"
    }

  /** The app's persisted sessions. Entries that do not parse are skipped. */
  fun parseAppTimers(json: String?): Map<String, AppTimer> {
    val root = MiniJson.parseObjectOrNull(json) ?: return emptyMap()
    val result = LinkedHashMap<String, AppTimer>()
    for ((id, raw) in root) {
      val entry = raw as? Map<*, *> ?: continue
      val startedAt = parseInstantMs(entry["startedAt"]) ?: continue
      val offset = (entry["pauseOffsetMs"] as? Double ?: 0.0).toLong()
      result[id] = AppTimer(startedAt, parseInstantMs(entry["pausedAt"]), offset)
    }
    return result
  }

  /** Seconds as `DateUtils.formatElapsedTime` prints them, which is what a Chronometer shows. */
  fun formatElapsed(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val sec = seconds % 60
    return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, sec) else String.format(Locale.US, "%02d:%02d", m, sec)
  }

  /**
   * The list, with the habit drawn as the pinned card above it taken out.
   *
   * The NOW heading goes with it unless another running habit is left under it:
   * a heading whose only row has been lifted out would sit above whatever comes
   * next and label that instead. This lived in the view code once and broke
   * silently when the sections either side of it changed.
   */
  /**
   * The habit drawn as the pinned card above the list: the one the widget is
   * timing. A timer the app is running stays an ordinary row — the app owns it,
   * and the card's clock would be ticking for something we must not stop.
   */
  fun pinnedHabit(rows: List<WidgetRow>): WidgetRow.Habit? =
    rows.firstOrNull { it is WidgetRow.Habit && it.runningSinceMs != null && !it.inApp } as? WidgetRow.Habit

  fun rowsWithoutPinned(rows: List<WidgetRow>, pinned: WidgetRow.Habit?): List<WidgetRow> {
    if (pinned == null) return rows
    val withoutPinned = rows.filter { it !== pinned }
    return withoutPinned.filterIndexed { index, row ->
      if (row !is WidgetRow.Label || row.section != Section.NOW) return@filterIndexed true
      val next = withoutPinned.getOrNull(index + 1)
      next is WidgetRow.Habit && next.runningSinceMs != null
    }
  }

  /**
   * The figure under a timer habit's name, or null when there is none to show.
   *
   * An untouched row shows its goal rather than `00:00 / 15:00`: the zero is the
   * same on every row that has not been started, so it separates nothing, and a
   * screen of them buries the one habit that is actually under way. `started`
   * covers a running or paused session as well as time logged earlier today.
   *
   * `isGoal` asks the caller to name it as one — alone, `22:20` reads as a time
   * of day. A figure with a clock already in it needs no such label.
   */
  fun timerFigure(shownSeconds: Int, targetSeconds: Int?, started: Boolean): TimerFigure? {
    if (!started && shownSeconds <= 0) {
      return targetSeconds?.let { TimerFigure(formatElapsed(it), isGoal = true) }
    }
    val goal = targetSeconds?.let { " / ${formatElapsed(it)}" } ?: ""
    return TimerFigure(formatElapsed(shownSeconds) + goal, isGoal = false)
  }

  /** A stopped timer shorter than this was a mistap: nothing is logged. */
  const val MIN_TIMER_SESSION_SECONDS = 5

  /**
   * What a finished session is worth, in seconds.
   *
   * A session is logged against the day it started on, so it can be worth no
   * more than what was left of that day when it started. Without the ceiling a
   * stopwatch nobody stopped — the widget removed, the habit forgotten — logs
   * one event claiming days of reading on a single Tuesday.
   */
  fun cappedSessionSeconds(timer: RunningTimer, nowMs: Long): Long {
    val elapsed = timerElapsedMs(timer, nowMs)
    val startOfNextDay = parseDate(timer.date)
      ?.plusDays(1)
      ?.atStartOfDay(ZoneId.systemDefault())
      ?.toInstant()
      ?.toEpochMilli()
      ?: return elapsed / 1000
    val roomLeftInTheDay = (startOfNextDay - timer.startedAtMs).coerceAtLeast(0)
    return elapsed.coerceAtMost(roomLeftInTheDay) / 1000
  }

  /** `activeTimerElapsedMs` (activeTimerSession.ts): active time, paused intervals left out. */
  fun timerElapsedMs(timer: RunningTimer, nowMs: Long): Long {
    val paused = timer.pauseOffsetMs + (timer.pausedAtMs?.let { nowMs - it } ?: 0)
    return (nowMs - timer.startedAtMs - paused).coerceAtLeast(0)
  }

  /**
   * The whole timer state machine, with no I/O: what `action` does to a habit's
   * widget timer at `nowMs`. `lockedByApp` is true while the app is timing the
   * same habit — two timers would log the same minutes twice.
   */
  fun applyTimerAction(
    rules: HabitRules,
    current: RunningTimer?,
    action: TimerAction,
    nowMs: Long,
    today: String,
    lockedByApp: Boolean,
  ): TimerOutcome {
    val trackId = rules.soundTrackId
    if (current == null) {
      if (action != TimerAction.TOGGLE || lockedByApp || !rules.timer) {
        // Nothing to time here, so nothing should still be sounding for this
        // habit. Stop rather than None: the sound outlives the timer row — a
        // Clear or an import deletes it mid-session — and the Stop button must
        // not need the row to silence it. The player acts only when it is this
        // habit's sound that is playing, so this costs nothing otherwise.
        return TimerOutcome(null, null, PlayerCommand.Stop)
      }
      val player = if (trackId != null) PlayerCommand.Play(trackId, rules.soundLoops, 0) else PlayerCommand.None
      return TimerOutcome(RunningTimer(nowMs, today), null, player)
    }

    val pausedAt = current.pausedAtMs
    if (trackId != null && (action == TimerAction.TOGGLE || action == TimerAction.PAUSE)) {
      if (pausedAt == null) {
        return TimerOutcome(current.copy(pausedAtMs = nowMs), null, PlayerCommand.Pause)
      }
      if (action == TimerAction.PAUSE) return TimerOutcome(current, null, PlayerCommand.None)
      val resumed = current.copy(pausedAtMs = null, pauseOffsetMs = current.pauseOffsetMs + (nowMs - pausedAt))
      return TimerOutcome(resumed, null, PlayerCommand.Play(trackId, rules.soundLoops, timerElapsedMs(current, nowMs)))
    }
    if (action == TimerAction.PAUSE) return TimerOutcome(current, null, PlayerCommand.None)

    // TOGGLE on a stopwatch, STOP, or the track ending: the session is over.
    val completed = action == TimerAction.TRACK_ENDED && rules.playOnceTrackSeconds != null
    val seconds = cappedSessionSeconds(current, nowMs)
    val log = if ((seconds >= MIN_TIMER_SESSION_SECONDS || completed) && seconds <= Int.MAX_VALUE) {
      TimerLog(current, nowMs, seconds.toInt().coerceAtLeast(1), completed)
    } else {
      null
    }
    // Stop whether or not the habit still has a sound: it may have had one when
    // the session started and lost it since, and the sound is playing either way.
    return TimerOutcome(null, log, PlayerCommand.Stop)
  }

  /** Meta of a logged timer chunk: the protocol's `timer_session` shape (habit.ts). */
  fun timerSessionMetaJson(
    startedAt: Instant,
    endedAt: Instant,
    durationSeconds: Int,
    trackCompleted: Boolean = false,
  ): String =
    "{\"source\":\"$TIMER_SESSION_SOURCE\",\"startedAt\":\"${isoTimestamp(startedAt)}\"," +
      "\"endedAt\":\"${isoTimestamp(endedAt)}\",\"durationSeconds\":$durationSeconds" +
      (if (trackCompleted) ",\"trackCompleted\":true" else "") + "}"

  /** Meta of a boolean habit tick (eventStore.toggleHabit). */
  const val HABIT_TICK_META_JSON = "{\"source\":\"habit_tick\"}"

  const val SKIP_SOURCE = "skip"
  const val TIMER_SESSION_SOURCE = "timer_session"

  /** `PROTOCOL_VERSION` (src/protocol/envelope.ts). */
  const val PROTOCOL_VERSION = 1
}
