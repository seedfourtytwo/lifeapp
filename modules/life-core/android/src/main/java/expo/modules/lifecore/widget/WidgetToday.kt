package expo.modules.lifecore.widget

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** One tracker as it stands at the moment the widget draws. */
data class TodayTracker(
  val source: SnapshotTracker,
  val due: Boolean,
  val done: Boolean,
  val total: Double,
  /** Null when it cannot be known without the app (the snapshot is two days old or more). */
  val streak: Int?,
  val sevenDays: List<StripState>,
)

data class TodayCommitment(
  val source: SnapshotCommitment,
  val clearMs: Long,
  val nextLamp: Lamps.Next,
  /** How far from the lamp passed last to the next one, 0 to 1. */
  val towardLamp: Double,
  val ownLine: String?,
  val urgesToday: Int,
  val urgesRiddenOut: Int,
  /** The commitment's last seven days, oldest first. */
  val sevenDays: List<StripState>,
)

data class Today(
  val nowMs: Long,
  val date: LocalDate,
  val zone: ZoneId,
  val trackers: List<TodayTracker>,
  val commitment: TodayCommitment?,
  /** The urge's ride still running, or null. */
  val ride: Ride?,
) {
  val dueCount: Int get() = trackers.count { it.due }
  val doneCount: Int get() = trackers.count { it.due && it.done }

  fun tracker(id: String): TodayTracker? = trackers.firstOrNull { it.source.id == id }
}

/**
 * Today as the widget shows it, worked out from the last snapshot, the
 * queue lines JavaScript has not applied yet, and the clock: the
 * contract's overlay rules and its "working out today without the app".
 */
object WidgetToday {
  const val DEFAULT_RIDE_SECONDS = 600

  /** The strip moved on by `passed` days, each new day judged by `newDay`. */
  private fun shift(days: List<StripState>, from: LocalDate, passed: Long, newDay: (LocalDate) -> StripState): List<StripState> {
    if (passed <= 0) return days
    val added = (maxOf(1L, passed - days.size + 1)..passed).map { newDay(from.plusDays(it)) }
    return (days + added).takeLast(days.size)
  }

  private fun rolledOver(tracker: SnapshotTracker, snapshotDate: LocalDate, date: LocalDate): TodayTracker {
    val passed = ChronoUnit.DAYS.between(snapshotDate, date)
    if (passed <= 0) return TodayTracker(tracker, tracker.dueToday, tracker.done, tracker.total, tracker.streak, tracker.sevenDays)
    val commitment = tracker.kind == TrackerKind.COMMITMENT
    val dueOn = { day: LocalDate -> tracker.kind != TrackerKind.HABIT || DayRules.isDue(tracker.schedule, day) }
    val streak = when {
      passed > 1 -> null
      tracker.done || !tracker.dueToday -> tracker.streak
      else -> 0
    }
    return TodayTracker(
      source = tracker,
      due = dueOn(date),
      done = commitment,
      total = 0.0,
      streak = streak,
      sevenDays = shift(tracker.sevenDays, snapshotDate, passed) { day ->
        when {
          commitment -> StripState.DONE
          dueOn(day) -> StripState.NOT_DONE
          else -> StripState.NOT_DUE
        }
      },
    )
  }

  private fun trackerIdOf(line: QueuedAction): String? = when (line) {
    is QueuedAction.HabitComplete -> line.trackerId
    is QueuedAction.CounterAdd -> line.trackerId
    is QueuedAction.TimerSessionDone -> line.trackerId
    is QueuedAction.UrgeLogged, is QueuedAction.UrgeResolved -> null
  }

  /** Today's taps on this tracker, on top of what the snapshot says. */
  private fun overlaid(tracker: TodayTracker, lines: List<QueuedAction>): TodayTracker {
    val mine = lines.filter { trackerIdOf(it) == tracker.source.id }
    if (mine.isEmpty()) return tracker
    var total = tracker.total
    var trackCompleted = false
    var marked = false
    for (line in mine) {
      when (line) {
        // A check-off's tick is its one unit; a tick for a timer habit is not applied.
        is QueuedAction.HabitComplete -> if (tracker.source.isCheckOff) total = maxOf(total, 1.0)
        is QueuedAction.CounterAdd -> total += line.amount
        is QueuedAction.TimerSessionDone -> {
          total += line.activeSeconds
          trackCompleted = trackCompleted || line.trackCompleted
          marked = marked || line.markComplete
        }
        is QueuedAction.UrgeLogged, is QueuedAction.UrgeResolved -> Unit
      }
    }
    val done = tracker.done || DayRules.outcome(tracker.source.rule, DayFacts(total, trackCompleted, marked)).done
    val strip = if (done && tracker.due) tracker.sevenDays.dropLast(1) + StripState.DONE else tracker.sevenDays
    return tracker.copy(done = done, total = total, sevenDays = strip)
  }

  /**
   * @param queued every line read from the queue files, and those this
   *   process appended lately; a line counts when it is newer than the snapshot.
   */
  fun of(snapshot: Snapshot, queued: List<QueuedAction>, nowMs: Long, zone: ZoneId): Today {
    val date = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
    val fresh = queued.filter { it.atMs > snapshot.generatedAtMs }.distinctBy { it.id }
    val todays = fresh.filter { it.day == date }
    val trackers = snapshot.trackers.map { overlaid(rolledOver(it, snapshot.date, date), todays) }

    val rideSeconds = snapshot.commitment?.rideSeconds ?: DEFAULT_RIDE_SECONDS
    val resolved = fresh.filterIsInstance<QueuedAction.UrgeResolved>().map { it.urgeId }.toSet()
    val rides = (listOfNotNull(snapshot.ride) + fresh.filterIsInstance<QueuedAction.UrgeLogged>().map {
      Ride(it.id, it.atMs, it.atMs + rideSeconds * 1000L)
    }).distinctBy { it.urgeId }.filter { it.urgeId !in resolved }
    // A ride that ended untouched counts as ridden out from its end, app or no app.
    val riddenOut = rides.count { it.endsAtMs <= nowMs }
    val ride = rides.filter { it.endsAtMs > nowMs }.maxByOrNull { it.startedAtMs }

    val commitment = snapshot.commitment?.let { source ->
      val next = Lamps.next(source.clearSinceMs, nowMs)
      val previousMs = source.clearSinceMs + Lamps.previousHours(source.clearSinceMs, nowMs) * Lamps.HOUR_MS
      val loggedToday = todays.count { it is QueuedAction.UrgeLogged }
      val sameDay = !date.isAfter(snapshot.date)
      TodayCommitment(
        source = source,
        clearMs = maxOf(0L, nowMs - source.clearSinceMs),
        nextLamp = next,
        towardLamp = ((nowMs - previousMs).toDouble() / (next.atMs - previousMs)).coerceIn(0.0, 1.0),
        ownLine = Lamps.ownLine(source.ownLines, source.clearSinceMs, nowMs),
        urgesToday = (if (sameDay) source.urgesToday else 0) + loggedToday,
        urgesRiddenOut = source.urgesRiddenOut + riddenOut,
        sevenDays = trackers.firstOrNull { it.source.id == source.id }?.sevenDays ?: emptyList(),
      )
    }
    return Today(nowMs, date, zone, trackers, commitment, ride)
  }
}
