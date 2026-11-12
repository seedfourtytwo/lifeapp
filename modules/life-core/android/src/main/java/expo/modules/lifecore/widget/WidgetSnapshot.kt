package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * `files/widget/snapshot.json` as the widget reads it (`WidgetSnapshotSchema`,
 * `docs/widget-contract.md`): only the fields the widget uses. A tracker's
 * `name` is read because the home screen may show it; nothing built for the
 * keyguard can reach it (see [NeutralLabel]).
 */
data class Snapshot(
  val generatedAtMs: Long,
  val date: LocalDate,
  val endsAtMs: Long,
  val zone: ZoneId,
  val trackers: List<SnapshotTracker>,
  val commitment: SnapshotCommitment?,
  val ride: Ride?,
)

enum class TrackerKind { HABIT, COUNTER, COMMITMENT }

/** One day of a strip; `NOT_DONE` on a commitment is a slip. */
enum class StripState { DONE, NOT_DONE, NOT_DUE, NOT_COUNTED }

data class SnapshotTimer(val goal: TimerGoal, val trackId: String?, val loop: Boolean)

data class SnapshotTracker(
  val id: String,
  val kind: TrackerKind,
  val name: String,
  val lockScreenName: String?,
  val icon: String?,
  val dueToday: Boolean,
  val done: Boolean,
  val total: Double,
  val target: Double?,
  val streak: Int,
  val schedule: Schedule,
  val sevenDays: List<StripState>,
  /** Habits: the window outside which the app hides the habit, when `visibleOnlyInTimeRange`. */
  val shownOnlyBetween: Pair<LocalTime, LocalTime>?,
  /** Timer habits only. */
  val timer: SnapshotTimer?,
  /** Counters only; empty otherwise. */
  val quickIncrements: List<Double>,
) {
  val isCheckOff: Boolean get() = kind == TrackerKind.HABIT && timer == null

  val rule: DoneRule
    get() = when (kind) {
      TrackerKind.HABIT -> timer?.let { DoneRule.Timer(it.goal) } ?: DoneRule.CheckOff
      TrackerKind.COUNTER -> DoneRule.Counter(target)
      TrackerKind.COMMITMENT -> DoneRule.Commitment
    }
}

data class InsteadHabit(val id: String, val lockScreenName: String?, val icon: String?)

data class SnapshotCommitment(
  val id: String,
  val lockScreenName: String,
  val clearSinceMs: Long,
  val ownLines: List<String>,
  val rideSeconds: Int,
  val urgesRiddenOut: Int,
  val urgesToday: Int,
  val insteadHabits: List<InsteadHabit>,
)

/** An urge's ride: open from `startedAtMs` until `endsAtMs`. */
data class Ride(val urgeId: String, val startedAtMs: Long, val endsAtMs: Long)

object SnapshotJson {
  const val VERSION = 3

  private fun instant(text: String): Long = Instant.parse(text).toEpochMilli()

  private fun JSONObject.nullableString(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)

  private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map(::getJSONObject)

  private fun goal(json: JSONObject): TimerGoal = when (val type = json.getString("type")) {
    "seconds" -> TimerGoal.Seconds(json.getInt("seconds"))
    "play_once" -> TimerGoal.PlayOnce(json.getInt("trackSeconds"))
    "open" -> TimerGoal.Open
    else -> throw IllegalArgumentException("Unknown timer goal $type")
  }

  internal fun schedule(json: JSONObject): Schedule = when (val type = json.getString("type")) {
    "daily" -> Schedule.Daily
    "weekdays" -> json.getJSONArray("days").let { days -> Schedule.Weekdays((0 until days.length()).map(days::getInt).toSet()) }
    "every_n_days" -> Schedule.EveryNDays(json.getInt("interval"), LocalDate.parse(json.getString("anchorDate")))
    else -> throw IllegalArgumentException("Unknown schedule $type")
  }

  private fun strip(state: String): StripState = when (state) {
    "done" -> StripState.DONE
    "not_done" -> StripState.NOT_DONE
    "not_due" -> StripState.NOT_DUE
    "not_counted" -> StripState.NOT_COUNTED
    else -> throw IllegalArgumentException("Unknown strip state $state")
  }

  private fun tracker(json: JSONObject): SnapshotTracker {
    val kind = when (val kind = json.getString("kind")) {
      "habit" -> TrackerKind.HABIT
      "counter" -> TrackerKind.COUNTER
      "commitment" -> TrackerKind.COMMITMENT
      else -> throw IllegalArgumentException("Unknown tracker kind $kind")
    }
    val window = json.optJSONObject("timeRange")
      ?.takeIf { json.optBoolean("visibleOnlyInTimeRange", false) }
      ?.let { LocalTime.parse(it.getString("start")) to LocalTime.parse(it.getString("end")) }
    val timer = json.optJSONObject("timer")?.let {
      SnapshotTimer(goal(it.getJSONObject("goal")), it.nullableString("trackId"), it.getBoolean("loop"))
    }
    val increments = json.optJSONArray("quickIncrements")
    return SnapshotTracker(
      id = json.getString("id"),
      kind = kind,
      name = json.getString("name"),
      lockScreenName = json.nullableString("lockScreenName"),
      icon = json.nullableString("icon"),
      dueToday = json.getBoolean("dueToday"),
      done = json.getBoolean("done"),
      total = json.getDouble("total"),
      target = if (json.isNull("target")) null else json.getDouble("target"),
      streak = json.getInt("streak"),
      schedule = schedule(json.getJSONObject("schedule")),
      sevenDays = json.getJSONArray("sevenDays").objects().map { strip(it.getString("state")) },
      shownOnlyBetween = window,
      timer = timer,
      quickIncrements = increments?.let { array -> (0 until array.length()).map(array::getDouble) } ?: emptyList(),
    )
  }

  private fun commitment(json: JSONObject) = SnapshotCommitment(
    id = json.getString("id"),
    lockScreenName = json.getString("lockScreenName"),
    clearSinceMs = instant(json.getString("clearSince")),
    ownLines = json.getJSONArray("ownLines").let { lines -> (0 until lines.length()).map(lines::getString) },
    rideSeconds = json.getInt("rideSeconds"),
    urgesRiddenOut = json.getInt("urgesRiddenOut"),
    urgesToday = json.getInt("urgesToday"),
    insteadHabits = json.getJSONArray("insteadHabits").objects().map {
      InsteadHabit(it.getString("id"), it.nullableString("lockScreenName"), it.nullableString("icon"))
    },
  )

  /** The snapshot, or null when the text is not one this widget knows ("show nothing rather than guess"). */
  fun parse(text: String): Snapshot? = try {
    val json = JSONObject(text)
    if (json.getInt("version") != VERSION) {
      null
    } else {
      val day = json.getJSONObject("day")
      Snapshot(
        generatedAtMs = instant(json.getString("generatedAt")),
        date = LocalDate.parse(day.getString("date")),
        endsAtMs = instant(day.getString("endsAt")),
        zone = ZoneId.of(day.getString("timeZone")),
        trackers = json.getJSONArray("trackers").objects().map(::tracker),
        commitment = json.optJSONObject("commitment")?.let(::commitment),
        ride = json.optJSONObject("ride")?.let {
          Ride(it.getString("urgeId"), instant(it.getString("startedAt")), instant(it.getString("endsAt")))
        },
      )
    }
  } catch (_: JSONException) {
    null
  } catch (_: IllegalArgumentException) {
    null
  } catch (_: DateTimeException) {
    null
  }
}
