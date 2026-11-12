package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerJson
import expo.modules.lifecore.TimerSessionRecord
import org.json.JSONException
import org.json.JSONObject
import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate

/**
 * A line of `pending-actions.jsonl` (`WidgetActionSchema`): what the widget
 * appends for a tap, and what it reads back to show a tap before JavaScript
 * has applied it.
 */
sealed interface QueuedAction {
  val id: String
  val atMs: Long
  /** The app day at the tap. */
  val day: LocalDate

  data class HabitComplete(override val id: String, override val atMs: Long, override val day: LocalDate, val trackerId: String) : QueuedAction

  data class CounterAdd(
    override val id: String,
    override val atMs: Long,
    override val day: LocalDate,
    val trackerId: String,
    val amount: Double,
  ) : QueuedAction

  /** A finished timer session, as native queued it. */
  data class TimerSessionDone(
    override val id: String,
    override val atMs: Long,
    override val day: LocalDate,
    val trackerId: String,
    val activeSeconds: Long,
    val trackCompleted: Boolean,
    val markComplete: Boolean,
  ) : QueuedAction {
    companion object {
      fun of(record: TimerSessionRecord) = TimerSessionDone(
        record.id,
        record.atMs,
        LocalDate.parse(record.day),
        record.trackerId,
        record.activeSeconds,
        record.trackCompleted,
        record.markComplete,
      )
    }
  }

  data class UrgeLogged(override val id: String, override val atMs: Long, override val day: LocalDate) : QueuedAction

  data class UrgeResolved(override val id: String, override val atMs: Long, override val day: LocalDate, val urgeId: String) : QueuedAction
}

object QueueLines {
  private fun base(type: String, action: QueuedAction): JSONObject = JSONObject()
    .put("v", 1)
    .put("id", action.id)
    .put("at", TimerJson.instant(action.atMs))
    .put("day", action.day.toString())
    .put("type", type)

  /** The line for a tap, without its newline. A finished session's line is [TimerJson.encodeRecord]'s. */
  fun encode(action: QueuedAction): String = when (action) {
    is QueuedAction.HabitComplete -> base("habit_complete", action).put("trackerId", action.trackerId)
    is QueuedAction.CounterAdd -> base("counter_add", action).put("trackerId", action.trackerId).put("amount", action.amount)
    is QueuedAction.UrgeLogged -> base("urge_logged", action)
    is QueuedAction.UrgeResolved -> base("urge_resolved", action).put("urgeId", action.urgeId).put("outcome", "used")
    is QueuedAction.TimerSessionDone -> throw IllegalArgumentException("Timer sessions are queued by the timer core")
  }.toString()

  private fun decode(line: String): QueuedAction? = try {
    val json = JSONObject(line)
    if (json.optInt("v") != 1) {
      null
    } else {
      val id = json.getString("id")
      val at = Instant.parse(json.getString("at")).toEpochMilli()
      val day = LocalDate.parse(json.getString("day"))
      when (json.getString("type")) {
        "habit_complete" -> QueuedAction.HabitComplete(id, at, day, json.getString("trackerId"))
        "counter_add" -> QueuedAction.CounterAdd(id, at, day, json.getString("trackerId"), json.getDouble("amount"))
        "timer_session" -> QueuedAction.TimerSessionDone(
          id,
          at,
          day,
          json.getString("trackerId"),
          json.getLong("activeSeconds"),
          json.getBoolean("trackCompleted"),
          json.getBoolean("markComplete"),
        )
        "urge_logged" -> QueuedAction.UrgeLogged(id, at, day)
        "urge_resolved" -> if (json.getString("outcome") == "used") QueuedAction.UrgeResolved(id, at, day, json.getString("urgeId")) else null
        else -> null
      }
    }
  } catch (_: JSONException) {
    null
  } catch (_: DateTimeException) {
    null
  }

  /**
   * Every complete line of a queue file that reads; text after the last
   * newline is a line still being written and is left for the next read.
   */
  fun parse(text: String): List<QueuedAction> =
    text.substringBeforeLast('\n', missingDelimiterValue = "").lineSequence().mapNotNull(::decode).toList()
}
