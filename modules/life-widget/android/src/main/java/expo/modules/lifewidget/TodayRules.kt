package expo.modules.lifewidget

import java.time.Instant
import java.time.LocalDate
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

sealed class WidgetRow {
  abstract val key: String

  data class Habit(
    val id: String,
    val name: String,
    val state: HabitRowState,
    val timer: Boolean,
    /** Timer habits: whole minutes logged today. */
    val timerMinutes: Int = 0,
    /** Timer habits: goal in minutes, when there is one. */
    val timerTargetMinutes: Int? = null,
    /** Timer habits: minutes the widget's quick-log buttons add. Empty when the app must run the timer. */
    val quickMinutes: List<Int> = emptyList(),
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
  ) : WidgetRow() {
    override val key: String get() = "counter:$id"
  }

  data class Todo(val id: String, val title: String) : WidgetRow() {
    override val key: String get() = "todo:$id"
  }

  object TodosLabel : WidgetRow() {
    override val key: String get() = "label:todos"
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
  /** Header figures: done of due, habits plus counters that have a target. */
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
    val sound = config["timerSound"]
    if (timer && sound is Map<*, *>) {
      val trackId = (sound["trackId"] as? String)?.trim()
      val playback = sound["playbackMode"] ?: "loop"
      if (playback == "play_once" && trackId != null) {
        playOnce = BUNDLED_TRACK_SECONDS[trackId]
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
   * open due habits, counters, a "Todos" label (only when something precedes
   * the todos), up to [MAX_TODOS] open todos, then done and skipped habits.
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
  ): TodayModel {
    val open = ArrayList<WidgetRow>()
    val settled = ArrayList<WidgetRow>()
    var due = 0
    var done = 0

    for (habit in habits) {
      if (!isVisibleAt(habit.rules, minuteOfDay)) continue
      val state = habitDayState(habit.rules, today) { date -> habitFacts(habit.id, date) }
      val rowState = when {
        state.due && state.done -> HabitRowState.DONE
        state.due -> HabitRowState.OPEN
        state.skipped && state.scheduled -> HabitRowState.SKIPPED
        else -> null
      } ?: continue

      if (state.due) {
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
          timerMinutes = Math.floor(seconds / 60.0).toInt(),
          timerTargetMinutes = target?.let { Math.round(it / 60.0).toInt() },
          quickMinutes = if (canQuickLog(habit.rules)) {
            timerQuickMinutes(habit.rules.dailyTargetSeconds?.let { Math.round(it / 60.0).toInt() })
          } else {
            emptyList()
          },
        )
      } else {
        WidgetRow.Habit(id = habit.id, name = habit.name, state = rowState, timer = false)
      }
      if (rowState == HabitRowState.OPEN) open.add(row) else settled.add(row)
    }

    for (counter in counters) {
      val target = counter.rules.dailyTarget
      // A skipped counter is not due, so it leaves the header count; its row stays usable.
      if (target != null && !isCounterDaySkipped(counter.rules, counter.todayTotal, counter.skippedRowToday)) {
        due++
        if (isCounterDayComplete(counter.rules, counter.todayTotal)) done++
      }
      open.add(
        WidgetRow.Counter(
          id = counter.id,
          name = counter.name,
          total = counter.todayTotal,
          target = target,
          increments = counter.rules.quickIncrements.take(2),
        ),
      )
    }

    val shownTodos = sortTodos(todos, today.toString()).take(MAX_TODOS)
    if (shownTodos.isNotEmpty()) {
      if (open.isNotEmpty()) open.add(WidgetRow.TodosLabel)
      for (todo in shownTodos) open.add(WidgetRow.Todo(todo.id, todo.title))
    }

    return TodayModel(rows = open + settled, done = done, due = due)
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

  /**
   * A play_once track habit without a time goal is complete only when the track
   * finishes (`trackCompleted`), which logged minutes never set: the app has to run it.
   */
  fun canQuickLog(rules: HabitRules): Boolean =
    rules.timer && (rules.playOnceTrackSeconds == null || rules.dailyTargetSeconds != null)

  /** Two chunk sizes that fit the goal: small ones for short goals, bigger ones for long. */
  fun timerQuickMinutes(targetMinutes: Int?): List<Int> =
    if (targetMinutes == null || targetMinutes <= 30) listOf(5, 15) else listOf(15, 30)

  /** Meta of a logged timer chunk: the protocol's `timer_session` shape (habit.ts). */
  fun timerSessionMetaJson(startedAt: Instant, endedAt: Instant, durationSeconds: Int): String =
    "{\"source\":\"$TIMER_SESSION_SOURCE\",\"startedAt\":\"${isoTimestamp(startedAt)}\"," +
      "\"endedAt\":\"${isoTimestamp(endedAt)}\",\"durationSeconds\":$durationSeconds}"

  /** Meta of a boolean habit tick (eventStore.toggleHabit). */
  const val HABIT_TICK_META_JSON = "{\"source\":\"habit_tick\"}"

  const val SKIP_SOURCE = "skip"
  const val TIMER_SESSION_SOURCE = "timer_session"

  /** `PROTOCOL_VERSION` (src/protocol/envelope.ts). */
  const val PROTOCOL_VERSION = 1
}
