package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * The few day rules the widget needs, the same as the app's TypeScript ones
 * (`dayOutcome`, `isScheduleActiveOnDate`, the lamps, the clear-time clock);
 * `modules/life-core/fixtures` holds the cases both languages run.
 */

/** What finishes a tracker's day, as the snapshot describes the tracker. */
sealed interface DoneRule {
  data object CheckOff : DoneRule
  data class Timer(val goal: TimerGoal) : DoneRule
  /** A null target is never done. */
  data class Counter(val target: Double?) : DoneRule
  data object Commitment : DoneRule
}

/** One tracker's day as far as the rule needs it. */
data class DayFacts(val total: Double, val trackCompleted: Boolean = false, val markedComplete: Boolean = false)

/** The snapshot's `reason`, by its wire name. */
enum class DoneReason(val wire: String) {
  CHECKED("checked"),
  NOT_CHECKED("not_checked"),
  TARGET_MET("target_met"),
  UNDER_TARGET("under_target"),
  TRACK_FINISHED("track_finished"),
  TRACK_NOT_FINISHED("track_not_finished"),
  TIME_LOGGED("time_logged"),
  NOTHING_LOGGED("nothing_logged"),
  MARKED_COMPLETE("marked_complete"),
  NO_TARGET("no_target"),
  CLEAR("clear"),
  SLIPPED("slipped"),
}

data class DayOutcome(val done: Boolean, val reason: DoneReason)

/** A habit's schedule; counters and the commitment are `Daily`. */
sealed interface Schedule {
  data object Daily : Schedule
  /** 0 = Sunday … 6 = Saturday. */
  data class Weekdays(val days: Set<Int>) : Schedule
  data class EveryNDays(val interval: Int, val anchor: LocalDate) : Schedule
}

object DayRules {
  private fun natural(rule: DoneRule, facts: DayFacts): DayOutcome {
    val total = facts.total
    return when (rule) {
      DoneRule.CheckOff -> if (total >= 1) DayOutcome(true, DoneReason.CHECKED) else DayOutcome(false, DoneReason.NOT_CHECKED)
      is DoneRule.Timer -> when (val goal = rule.goal) {
        is TimerGoal.Seconds ->
          if (total >= goal.seconds) DayOutcome(true, DoneReason.TARGET_MET) else DayOutcome(false, DoneReason.UNDER_TARGET)
        is TimerGoal.PlayOnce ->
          if (facts.trackCompleted) DayOutcome(true, DoneReason.TRACK_FINISHED) else DayOutcome(false, DoneReason.TRACK_NOT_FINISHED)
        TimerGoal.Open -> if (total > 0) DayOutcome(true, DoneReason.TIME_LOGGED) else DayOutcome(false, DoneReason.NOTHING_LOGGED)
      }
      is DoneRule.Counter -> {
        val target = rule.target
        when {
          target == null || target <= 0 -> DayOutcome(false, DoneReason.NO_TARGET)
          total >= target -> DayOutcome(true, DoneReason.TARGET_MET)
          else -> DayOutcome(false, DoneReason.UNDER_TARGET)
        }
      }
      DoneRule.Commitment -> if (total == 0.0) DayOutcome(true, DoneReason.CLEAR) else DayOutcome(false, DoneReason.SLIPPED)
    }
  }

  fun outcome(rule: DoneRule, facts: DayFacts): DayOutcome {
    val natural = natural(rule, facts)
    val markable = rule is DoneRule.CheckOff || rule is DoneRule.Timer
    return if (!natural.done && markable && facts.markedComplete) DayOutcome(true, DoneReason.MARKED_COMPLETE) else natural
  }

  /** Scheduled on this local date; calendar days, so a clock change never shifts it. */
  fun isDue(schedule: Schedule, date: LocalDate): Boolean = when (schedule) {
    Schedule.Daily -> true
    is Schedule.Weekdays -> date.dayOfWeek.sundayFirst() in schedule.days
    is Schedule.EveryNDays -> {
      val elapsed = ChronoUnit.DAYS.between(schedule.anchor, date)
      elapsed >= 0 && elapsed % schedule.interval == 0L
    }
  }

  private fun DayOfWeek.sundayFirst(): Int = value % 7
}

/** The lamps: 24 h, 48 h, 3, 5, 7, 10 and 14 days after clear-since, then every 7 days. */
object Lamps {
  const val HOUR_MS = 3_600_000L
  private val FIXED = longArrayOf(24, 48, 72, 120, 168, 240, 336)
  private const val EVERY = 168L

  data class Next(val hours: Long, val atMs: Long)

  fun hours(index: Int): Long =
    if (index < FIXED.size) FIXED[index] else FIXED.last() + EVERY * (index - FIXED.size + 1)

  /** Lamps reached at `nowMs`; a lamp is passed exactly at its hour. */
  fun passed(clearSinceMs: Long, nowMs: Long): Int {
    val elapsedMs = nowMs - clearSinceMs
    val fixed = FIXED.count { it * HOUR_MS <= elapsedMs }
    if (fixed < FIXED.size) return fixed
    return fixed + ((elapsedMs - FIXED.last() * HOUR_MS) / (EVERY * HOUR_MS)).toInt()
  }

  fun next(clearSinceMs: Long, nowMs: Long): Next {
    val hours = hours(passed(clearSinceMs, nowMs))
    return Next(hours, clearSinceMs + hours * HOUR_MS)
  }

  /** The lamp before the next one, in hours after clear-since; 0 before the first. */
  fun previousHours(clearSinceMs: Long, nowMs: Long): Long {
    val passed = passed(clearSinceMs, nowMs)
    return if (passed == 0) 0 else hours(passed - 1)
  }

  /** One line per lamp passed, round again after the last; null without lines. */
  fun ownLine(lines: List<String>, clearSinceMs: Long, nowMs: Long): String? =
    if (lines.isEmpty()) null else lines[passed(clearSinceMs, nowMs) % lines.size]
}

/** Time clear as the widget words it: "42m", "5h 12m", "2d 14h"; always rounded down, never below zero. */
sealed interface ClearTime {
  data class Minutes(val minutes: Long) : ClearTime
  data class HoursMinutes(val hours: Long, val minutes: Long) : ClearTime
  data class DaysHours(val days: Long, val hours: Long) : ClearTime

  companion object {
    private const val MINUTE_MS = 60_000L
    private const val HOUR_MS = 60 * MINUTE_MS
    private const val DAY_MS = 24 * HOUR_MS

    fun of(elapsedMs: Long): ClearTime {
      val ms = maxOf(0L, elapsedMs)
      return when {
        ms < HOUR_MS -> Minutes(ms / MINUTE_MS)
        ms < DAY_MS -> HoursMinutes(ms / HOUR_MS, (ms % HOUR_MS) / MINUTE_MS)
        else -> DaysHours(ms / DAY_MS, (ms % DAY_MS) / HOUR_MS)
      }
    }

    /** When the words for this elapsed time next change: the next minute under a day, else the next hour. */
    fun nextChangeMs(elapsedMs: Long): Long {
      val ms = maxOf(0L, elapsedMs)
      val step = if (ms < DAY_MS) MINUTE_MS else HOUR_MS
      return (ms / step + 1) * step - ms
    }
  }
}

/** A lamp's short name: "24h" and "48h", then whole days ("3d", "21d"). */
sealed interface LampLabel {
  data class Hours(val hours: Long) : LampLabel
  data class Days(val days: Long) : LampLabel

  companion object {
    fun of(hours: Long): LampLabel = if (hours < 72) Hours(hours) else Days(Math.round(hours / 24.0))
  }
}
