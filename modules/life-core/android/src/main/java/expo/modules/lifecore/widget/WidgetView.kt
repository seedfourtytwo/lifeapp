package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import expo.modules.lifecore.TimerSession
import expo.modules.lifecore.TimerStartRequest
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/** Who shows the widget: a locked phone's lock-screen page, or the home screen. */
enum class Host { KEYGUARD, HOME_SCREEN }

/** How the widget names a tracker. */
sealed interface Label {
  val icon: String?
}

/**
 * What a locked phone may show of a tracker: its lock-screen name (or none)
 * and its icon. Built only from those two fields, so a real name cannot
 * reach the lock screen: there is no constructor or copy to put one in.
 */
class NeutralLabel private constructor(val lockScreenName: String?, override val icon: String?) : Label {
  companion object {
    fun of(tracker: SnapshotTracker) = NeutralLabel(tracker.lockScreenName, tracker.icon)
    fun of(request: TimerStartRequest) = NeutralLabel(request.lockScreenName, request.iconKey)
  }
}

/** The home screen shows the real name. */
class NamedLabel private constructor(val name: String, override val icon: String?) : Label {
  companion object {
    fun of(tracker: SnapshotTracker) = NamedLabel(tracker.name, tracker.icon)
    fun of(request: TimerStartRequest) = NamedLabel(request.name, request.iconKey)
  }
}

/** Labels for one host. */
interface Labels<L : Label> {
  fun of(tracker: SnapshotTracker): L
  fun of(request: TimerStartRequest): L
}

object KeyguardLabels : Labels<NeutralLabel> {
  override fun of(tracker: SnapshotTracker) = NeutralLabel.of(tracker)
  override fun of(request: TimerStartRequest) = NeutralLabel.of(request)
}

object HomeScreenLabels : Labels<NamedLabel> {
  override fun of(tracker: SnapshotTracker) = NamedLabel.of(tracker)
  override fun of(request: TimerStartRequest) = NamedLabel.of(request)
}

/** The road picture: the last seven days as dashes (oldest first; brightness 0–1, null = none), the lamp, the car. */
data class Road(val dashes: List<Double?>, val lampAt: Double?, val carAt: Double)

/** The button beside the next thing to do. */
sealed interface NextButton {
  val trackerId: String

  data class Play(override val trackerId: String) : NextButton
  data class Tick(override val trackerId: String) : NextButton
  data class Add(override val trackerId: String, val amount: Double) : NextButton
}

sealed interface NextUp<out L : Label> {
  data class Action<L : Label>(val label: L, val button: NextButton) : NextUp<L>
  /** Nothing more is due today: his own line instead. */
  data class OwnLine(val text: String) : NextUp<Nothing>
  data object AllDone : NextUp<Nothing>
}

sealed interface HomeTop {
  /** Time clear large, named by the commitment's lock-screen name; today's count beside it. */
  data class Clear(val clear: ClearTime, val lockScreenName: String, val done: Int, val due: Int) : HomeTop
  /** No commitment: today's count large, the best current streak beside it (null: unknown until the app runs). */
  data class Count(val done: Int, val due: Int, val bestStreak: Int?) : HomeTop
}

/** The line under the road: the next lamp, how long until it, urges ridden out. */
data class RoadNote(val lamp: LampLabel, val until: ClearTime, val riddenOut: Int)

data class InsteadButton<L : Label>(val trackerId: String, val label: L, val goalSeconds: Int?)

/** Everything the widget shows, for one host. `L` is that host's [Label]. */
sealed interface WidgetView<out L : Label> {
  data class Timer<L : Label>(
    val label: L,
    val activeMs: Long,
    val running: Boolean,
    /** Active time at which today's seconds goal is met; null without one, or when it was met before. */
    val goalMs: Long?,
  ) : WidgetView<L>

  data class Riding<L : Label>(val ride: Ride, val road: Road, val instead: InsteadButton<L>?) : WidgetView<L>

  data class Home<L : Label>(val top: HomeTop, val road: Road, val note: RoadNote?, val next: NextUp<L>) : WidgetView<L>

  /** No snapshot to read: the app icon and "Open Life". */
  data object Empty : WidgetView<Nothing>
}

/** A view and the next moment it changes by the clock alone (null: only a tap or a write changes it). */
data class WidgetFrame<out L : Label>(val view: WidgetView<L>, val redrawAtMs: Long?)

object WidgetViews {
  /** Where the tail lights sit on the road (0 = near edge, 1 = horizon). */
  const val CAR_AT = 0.1
  private const val LAMP_FARTHEST = 0.9
  private const val DIM = 0.16
  private const val MINUTE_MS = 60_000L
  private const val DAY_MS = 24 * 60 * MINUTE_MS

  fun <L : Label> build(
    snapshot: Snapshot?,
    timer: TimerSession?,
    queued: List<QueuedAction>,
    nowMs: Long,
    zone: ZoneId,
    labels: Labels<L>,
  ): WidgetFrame<L> {
    val today = snapshot?.let { WidgetToday.of(it, queued, nowMs, zone) }
    val redraw = today?.let(::redrawAt)
    if (timer != null) return WidgetFrame(timerView(timer, nowMs, labels), redraw)
    if (today == null) return WidgetFrame(WidgetView.Empty, null)
    val ride = today.ride
    return if (ride != null) WidgetFrame(rideView(today, ride, labels), redraw) else WidgetFrame(homeView(today, labels), redraw)
  }

  private fun <L : Label> timerView(session: TimerSession, nowMs: Long, labels: Labels<L>): WidgetView.Timer<L> {
    val request = session.request
    val goalMs = (request.goal as? TimerGoal.Seconds)
      ?.let { (it.seconds - request.loggedSeconds) * 1000L }
      ?.takeIf { it > 0 }
    return WidgetView.Timer(labels.of(request), session.activeMs(nowMs), !session.isPaused, goalMs)
  }

  private fun <L : Label> rideView(today: Today, ride: Ride, labels: Labels<L>): WidgetView.Riding<L> {
    val progress = ((today.nowMs - ride.startedAtMs).toDouble() / (ride.endsAtMs - ride.startedAtMs)).coerceIn(0.0, 1.0)
    val instead = today.commitment?.source?.insteadHabits.orEmpty().firstNotNullOfOrNull { habit ->
      today.tracker(habit.id)?.source?.takeIf { it.timer != null }?.let { tracker ->
        InsteadButton(tracker.id, labels.of(tracker), (tracker.timer?.goal as? TimerGoal.Seconds)?.seconds)
      }
    }
    return WidgetView.Riding(ride, Road(emptyList(), lampAt(1 - progress), CAR_AT), instead)
  }

  private fun lampAt(distance: Double) = CAR_AT + (LAMP_FARTHEST - CAR_AT) * distance.coerceIn(0.0, 1.0)

  private fun level(state: StripState): Double? = when (state) {
    StripState.DONE -> 1.0
    StripState.NOT_DONE, StripState.NOT_DUE -> DIM
    StripState.NOT_COUNTED -> null
  }

  /** Without a commitment, a day's dash is as bright as the share of what was due that got done. */
  private fun sharedDashes(today: Today): List<Double?> {
    val counted = today.trackers.filter { it.source.rule.canBeDone() }
    return (0 until DAYS).map { index ->
      val states = counted.mapNotNull { it.sevenDays.getOrNull(index) }
      val due = states.count { it == StripState.DONE || it == StripState.NOT_DONE }
      if (due == 0) null else DIM + (1 - DIM) * states.count { it == StripState.DONE } / due
    }
  }

  private fun DoneRule.canBeDone(): Boolean = this !is DoneRule.Commitment && !(this is DoneRule.Counter && target == null)

  private fun shownAt(tracker: SnapshotTracker, time: LocalTime): Boolean {
    val (start, end) = tracker.shownOnlyBetween ?: return true
    return if (start <= end) time >= start && time < end else time >= start || time < end
  }

  private fun button(tracker: SnapshotTracker): NextButton? = when (tracker.kind) {
    TrackerKind.HABIT -> if (tracker.timer != null) NextButton.Play(tracker.id) else NextButton.Tick(tracker.id)
    TrackerKind.COUNTER -> tracker.quickIncrements.firstOrNull()?.let { NextButton.Add(tracker.id, it) }
    TrackerKind.COMMITMENT -> null
  }

  private fun <L : Label> nextUp(today: Today, labels: Labels<L>): NextUp<L> {
    val time = Instant.ofEpochMilli(today.nowMs).atZone(today.zone).toLocalTime()
    val next = today.trackers.firstNotNullOfOrNull { tracker ->
      val source = tracker.source
      if (!tracker.due || tracker.done || !source.rule.canBeDone() || !shownAt(source, time)) null
      else button(source)?.let { NextUp.Action(labels.of(source), it) }
    }
    return next ?: today.commitment?.ownLine?.let { NextUp.OwnLine(it) } ?: NextUp.AllDone
  }

  private fun <L : Label> homeView(today: Today, labels: Labels<L>): WidgetView.Home<L> {
    val commitment = today.commitment
    if (commitment == null) {
      val best = today.trackers.filter { it.source.rule.canBeDone() }.map { it.streak }
      val bestStreak = if (best.any { it == null }) null else best.filterNotNull().maxOrNull() ?: 0
      return WidgetView.Home(
        HomeTop.Count(today.doneCount, today.dueCount, bestStreak),
        Road(sharedDashes(today), null, CAR_AT),
        null,
        nextUp(today, labels),
      )
    }
    return WidgetView.Home(
      HomeTop.Clear(ClearTime.of(commitment.clearMs), commitment.source.lockScreenName, today.doneCount, today.dueCount),
      Road(commitment.sevenDays.map(::level), lampAt(1 - commitment.towardLamp), CAR_AT),
      RoadNote(LampLabel.of(commitment.nextLamp.hours), ClearTime.of(commitment.nextLamp.atMs - today.nowMs), commitment.urgesRiddenOut),
      nextUp(today, labels),
    )
  }

  /** The next moment a countdown's words change ("1d 23h" → "1d 22h"). */
  private fun countdownChangeMs(remainingMs: Long): Long {
    val step = if (remainingMs <= DAY_MS) MINUTE_MS else 60 * MINUTE_MS
    val rest = remainingMs % step
    return if (rest == 0L) step else rest
  }

  /** The next moment the clock alone changes what shows: midnight, a lamp, a ride's end, a clock's words, a habit's window. */
  private fun redrawAt(today: Today): Long {
    val midnight = today.date.plusDays(1).atStartOfDay(today.zone).toInstant().toEpochMilli()
    val now = today.nowMs
    val commitment = today.commitment
    val windows = today.trackers.mapNotNull { it.source.shownOnlyBetween }.flatMap { (start, end) -> listOf(start, end) }
      .map { today.date.atTime(it).atZone(today.zone).toInstant().toEpochMilli() }
    return (
      listOf(midnight) +
        listOfNotNull(
          today.ride?.endsAtMs,
          commitment?.nextLamp?.atMs,
          commitment?.let { now + ClearTime.nextChangeMs(it.clearMs) },
          commitment?.let { now + countdownChangeMs(it.nextLamp.atMs - now) },
        ) +
        windows
      ).filter { it > now }.min()
  }

  private const val DAYS = 7
}
