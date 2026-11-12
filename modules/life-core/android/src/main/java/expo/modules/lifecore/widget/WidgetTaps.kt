package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerSession
import expo.modules.lifecore.TimerStartRequest
import java.time.Instant
import java.time.ZoneId
import kotlin.math.floor

/** A button on the widget. */
sealed interface Tap {
  data class Tick(val trackerId: String) : Tap
  data class Add(val trackerId: String, val amount: Double) : Tap
  /** Play on a timed habit, or the ride's instead-habit. */
  data class StartTimer(val trackerId: String) : Tap
  data object Pause : Tap
  data object Resume : Tap
  data object Done : Tap
  data object Discard : Tap
  data object Urge : Tap
  data class Used(val urgeId: String) : Tap
  /** "Play my note" on the ride. */
  data object PlayNote : Tap
}

/**
 * A tap as the text of its button's intent data, so every button has a
 * PendingIntent of its own (extras do not tell PendingIntents apart).
 */
object TapCodec {
  fun encode(tap: Tap): String = when (tap) {
    is Tap.Tick -> "tick/${tap.trackerId}"
    is Tap.Add -> "add/${tap.trackerId}/${tap.amount}"
    is Tap.StartTimer -> "start/${tap.trackerId}"
    Tap.Pause -> "pause"
    Tap.Resume -> "resume"
    Tap.Done -> "done"
    Tap.Discard -> "discard"
    Tap.Urge -> "urge"
    is Tap.Used -> "used/${tap.urgeId}"
    Tap.PlayNote -> "note"
  }

  fun decode(text: String): Tap? {
    val parts = text.split('/')
    val id = parts.getOrNull(1)?.takeIf { it.isNotEmpty() }
    return when (parts.size) {
      1 -> when (parts[0]) {
        "pause" -> Tap.Pause
        "resume" -> Tap.Resume
        "done" -> Tap.Done
        "discard" -> Tap.Discard
        "urge" -> Tap.Urge
        "note" -> Tap.PlayNote
        else -> null
      }
      2 -> id?.let {
        when (parts[0]) {
          "tick" -> Tap.Tick(it)
          "start" -> Tap.StartTimer(it)
          "used" -> Tap.Used(it)
          else -> null
        }
      }
      3 -> if (parts[0] == "add" && id != null) parts[2].toDoubleOrNull()?.let { Tap.Add(id, it) } else null
      else -> null
    }
  }
}

/** What a tap does: one queue line, one call into the timer core, or nothing. */
sealed interface TapEffect {
  data class Queue(val action: QueuedAction) : TapEffect
  data class Start(val request: TimerStartRequest) : TapEffect
  data object PauseTimer : TapEffect
  data object ResumeTimer : TapEffect
  /** Done: the day counts as done even short of the goal. */
  data object FinishTimer : TapEffect
  data object DiscardTimer : TapEffect
  /** Plays the voice note; the timer's sound ducks under it. */
  data object PlayNote : TapEffect
  /** A double tap, or a stale widget: a tracker gone, a day already done, a ride over. */
  data object Ignore : TapEffect
}

/**
 * Turns a tap into its effect against what is true now (not what the
 * widget showed when it was drawn), so a stale widget does nothing harmful.
 */
class WidgetTaps(private val newId: () -> String) {
  fun decide(
    tap: Tap,
    snapshot: Snapshot?,
    queued: List<QueuedAction>,
    timer: TimerSession?,
    nowMs: Long,
    zone: ZoneId,
  ): TapEffect {
    val today = snapshot?.let { WidgetToday.of(it, queued, nowMs, zone) }
    val day = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
    return when (tap) {
      is Tap.Tick -> today?.tracker(tap.trackerId)
        ?.takeIf { it.source.isCheckOff && !it.done }
        ?.let { TapEffect.Queue(QueuedAction.HabitComplete(newId(), nowMs, day, tap.trackerId)) }
      is Tap.Add -> today?.tracker(tap.trackerId)
        ?.takeIf { it.source.kind == TrackerKind.COUNTER && tap.amount in it.source.quickIncrements }
        ?.let { TapEffect.Queue(QueuedAction.CounterAdd(newId(), nowMs, day, tap.trackerId, tap.amount)) }
      is Tap.StartTimer -> today?.tracker(tap.trackerId)
        ?.takeIf { timer == null || timer.request.trackerId == tap.trackerId }
        ?.let(::startRequest)
        ?.let(TapEffect::Start)
      Tap.Pause -> timer?.takeIf { !it.isPaused }?.let { TapEffect.PauseTimer }
      Tap.Resume -> timer?.takeIf { it.isPaused }?.let { TapEffect.ResumeTimer }
      Tap.Done -> timer?.let { TapEffect.FinishTimer }
      Tap.Discard -> timer?.let { TapEffect.DiscardTimer }
      Tap.Urge -> if (today?.ride != null) null else TapEffect.Queue(QueuedAction.UrgeLogged(newId(), nowMs, day))
      is Tap.Used -> today?.ride
        ?.takeIf { it.urgeId == tap.urgeId }
        ?.let { TapEffect.Queue(QueuedAction.UrgeResolved(newId(), nowMs, day, tap.urgeId)) }
      Tap.PlayNote -> TapEffect.PlayNote
    } ?: TapEffect.Ignore
  }

  /** The timer core's request, as the app builds it: today's seconds so far, queued sessions included. */
  private fun startRequest(tracker: TodayTracker): TimerStartRequest? {
    val source = tracker.source
    val timer = source.timer ?: return null
    return TimerStartRequest(
      trackerId = source.id,
      name = source.name,
      lockScreenName = source.lockScreenName,
      iconKey = source.icon,
      goal = timer.goal,
      trackId = timer.trackId,
      loop = timer.loop,
      loggedSeconds = floor(tracker.total).toInt(),
    )
  }
}

/** One tap per moment: the same button pressed again within `windowMs` is the same press. */
class TapGuard(private val windowMs: Long) {
  private var last: Pair<Tap, Long>? = null

  @Synchronized
  fun accept(tap: Tap, nowMs: Long): Boolean {
    val previous = last
    if (previous != null && previous.first == tap && nowMs - previous.second in 0 until windowMs) return false
    last = tap to nowMs
    return true
  }
}
