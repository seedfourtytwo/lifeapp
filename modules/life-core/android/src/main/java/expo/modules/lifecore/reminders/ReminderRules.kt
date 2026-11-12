package expo.modules.lifecore.reminders

import expo.modules.lifecore.TimerSession
import expo.modules.lifecore.widget.DayRules
import expo.modules.lifecore.widget.Schedule
import expo.modules.lifecore.widget.Today
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/** A reminder to post now; Done is offered on a check-off habit the widget could tick. */
data class ReminderPost(val habit: PlanHabit, val offerDone: Boolean)

/**
 * When the reminder alarm goes off and what it posts, as pure rules: the
 * moments come from the plan, "still to do" from the widget's own view of
 * today (snapshot, queue overlay, and the day worked out without the app),
 * so a habit ticked on the widget is not reminded, app or no app.
 */
object ReminderRules {
  /** A moment the alarm reached later than this (phone off, clock moved) is let go. */
  const val LATE_LIMIT_MS = 60 * 60 * 1000L

  private fun date(ms: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(ms).atZone(zone).toLocalDate()

  /**
   * Each reminder time on a date the schedule is due, earliest first. A time
   * the spring change skips moves on by the gap (an hour later); one the
   * autumn change repeats is the first of the two (`ZonedDateTime.of`).
   */
  fun momentsOn(habit: PlanHabit, date: LocalDate, zone: ZoneId): List<Long> =
    if (!DayRules.isDue(habit.schedule, date)) {
      emptyList()
    } else {
      habit.reminderTimes.map { ZonedDateTime.of(date, it, zone).toInstant().toEpochMilli() }
    }

  /** Days to look ahead for a habit's next due day: a week, or up to its first or next turn. */
  private fun horizonDays(schedule: Schedule, from: LocalDate): Long = when (schedule) {
    Schedule.Daily -> 1
    is Schedule.Weekdays -> 7
    is Schedule.EveryNDays -> maxOf(0L, ChronoUnit.DAYS.between(from, schedule.anchor)) + schedule.interval
  }

  private fun firstAfter(habit: PlanHabit, afterMs: Long, zone: ZoneId): Long? {
    val from = date(afterMs, zone)
    for (days in 0..horizonDays(habit.schedule, from)) {
      momentsOn(habit, from.plusDays(days), zone).firstOrNull { it > afterMs }?.let { return it }
    }
    return null
  }

  /** The next moment after `afterMs` any habit reminds at; null when reminders are off or none are set. */
  fun next(plan: ReminderPlan, afterMs: Long, zone: ZoneId): Long? =
    if (!plan.enabled) null else plan.habits.mapNotNull { firstAfter(it, afterMs, zone) }.minOrNull()

  /**
   * Which reminders already on screen to take away: a habit now done or
   * with its timer session, one gone from the plan (archived, deleted, no
   * longer reminding), and all of them when there is no plan or reminders
   * are off. Nothing is ever posted again from here; only the alarm posts.
   */
  fun toClear(posted: Set<String>, plan: ReminderPlan?, today: Today?, timer: TimerSession?): Set<String> {
    if (plan == null || !plan.enabled) return posted
    val planned = plan.habits.map { it.id }.toSet()
    return posted.filterTo(mutableSetOf()) { id ->
      id !in planned || timer?.request?.trackerId == id || today?.tracker(id)?.done == true
    }
  }

  /**
   * What to post when the alarm armed for `armedForMs` goes off at `nowMs`:
   * every habit with a moment between the two (one post each, however many
   * moments), unless it is done today or its timer is running, and nothing
   * older than [LATE_LIMIT_MS].
   *
   * @param today the widget's today; null when there is no readable snapshot, and then every habit is still to do.
   */
  fun toPost(
    plan: ReminderPlan,
    armedForMs: Long,
    nowMs: Long,
    zone: ZoneId,
    today: Today?,
    timer: TimerSession?,
  ): List<ReminderPost> {
    if (!plan.enabled) return emptyList()
    val fromMs = maxOf(armedForMs, nowMs - LATE_LIMIT_MS)
    if (fromMs > nowMs) return emptyList()
    val dates = generateSequence(date(fromMs, zone)) { it.plusDays(1) }.takeWhile { !it.isAfter(date(nowMs, zone)) }.toList()
    return plan.habits
      .filter { habit -> dates.any { day -> momentsOn(habit, day, zone).any { it in fromMs..nowMs } } }
      .filter { habit -> timer?.request?.trackerId != habit.id }
      .mapNotNull { habit ->
        val tracker = today?.tracker(habit.id)
        if (tracker?.done == true) null else ReminderPost(habit, offerDone = tracker?.source?.isCheckOff == true)
      }
  }
}
