package expo.modules.lifecore

import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * The JSON both sides agree on: `CoreTimerStateSchema`, `TimerStartRequestSchema`
 * and `TimerSessionRecordSchema` in `src/protocol/coreTimer.ts`. Instants are
 * UTC with milliseconds and a `Z`, as `docs/widget-contract.md` requires.
 */
object TimerJson {
  private val instantFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

  fun instant(ms: Long): String = instantFormat.format(Instant.ofEpochMilli(ms))

  private fun parseInstant(text: String): Long = Instant.parse(text).toEpochMilli()

  /** The local calendar date at `ms` in the phone's zone: the app day. */
  fun localDay(ms: Long, zone: ZoneId = ZoneId.systemDefault()): String =
    Instant.ofEpochMilli(ms).atZone(zone).toLocalDate().toString()

  private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)

  private fun JSONObject.nullableInstant(key: String): Long? = nullableString(key)?.let(::parseInstant)

  private fun nullable(value: Any?): Any = value ?: JSONObject.NULL

  private fun encodeGoal(goal: TimerGoal): JSONObject = when (goal) {
    is TimerGoal.Seconds -> JSONObject().put("type", "seconds").put("seconds", goal.seconds)
    is TimerGoal.PlayOnce -> JSONObject().put("type", "play_once").put("trackSeconds", goal.trackSeconds)
    TimerGoal.Open -> JSONObject().put("type", "open")
  }

  private fun decodeGoal(json: JSONObject): TimerGoal = when (val type = json.getString("type")) {
    "seconds" -> TimerGoal.Seconds(json.getInt("seconds"))
    "play_once" -> TimerGoal.PlayOnce(json.getInt("trackSeconds"))
    "open" -> TimerGoal.Open
    else -> throw IllegalArgumentException("Unknown timer goal $type")
  }

  private fun encodeRequestInto(json: JSONObject, request: TimerStartRequest): JSONObject = json
    .put("trackerId", request.trackerId)
    .put("name", request.name)
    .put("lockScreenName", nullable(request.lockScreenName))
    .put("iconKey", nullable(request.iconKey))
    .put("goal", encodeGoal(request.goal))
    .put("trackId", nullable(request.trackId))
    .put("loop", request.loop)
    .put("loggedSeconds", request.loggedSeconds)

  private fun decodeRequest(json: JSONObject) = TimerStartRequest(
    trackerId = json.getString("trackerId"),
    name = json.getString("name"),
    lockScreenName = json.nullableString("lockScreenName"),
    iconKey = json.nullableString("iconKey"),
    goal = decodeGoal(json.getJSONObject("goal")),
    trackId = json.nullableString("trackId"),
    loop = json.getBoolean("loop"),
    loggedSeconds = json.getInt("loggedSeconds"),
  )

  fun decodeRequest(text: String): TimerStartRequest = decodeRequest(JSONObject(text))

  fun encodeSession(session: TimerSession): String = encodeRequestInto(JSONObject().put("sessionId", session.sessionId), session.request)
    .put("startedAt", instant(session.startedAtMs))
    .put("pausedAt", nullable(session.pausedAtMs?.let(::instant)))
    .put("pausedMs", session.pausedMs)
    .put("day", session.day)
    .put("goalReachedAt", nullable(session.goalReachedAtMs?.let(::instant)))
    .put("heartbeatAt", instant(session.heartbeatAtMs))
    .toString()

  fun decodeSession(text: String): TimerSession {
    val json = JSONObject(text)
    return TimerSession(
      sessionId = json.getString("sessionId"),
      request = decodeRequest(json),
      startedAtMs = parseInstant(json.getString("startedAt")),
      pausedAtMs = json.nullableInstant("pausedAt"),
      pausedMs = json.getLong("pausedMs"),
      day = json.getString("day"),
      goalReachedAtMs = json.nullableInstant("goalReachedAt"),
      heartbeatAtMs = parseInstant(json.getString("heartbeatAt")),
    )
  }

  /** One `timer_session` line, without its newline. */
  fun encodeRecord(record: TimerSessionRecord): String = JSONObject()
    .put("v", 1)
    .put("id", record.id)
    .put("at", instant(record.atMs))
    .put("day", record.day)
    .put("type", "timer_session")
    .put("trackerId", record.trackerId)
    .put("startedAt", instant(record.startedAtMs))
    .put("endedAt", instant(record.endedAtMs))
    .put("pausedMs", record.pausedMs)
    .put("activeSeconds", record.activeSeconds)
    .put("goalSecondsInForce", nullable(record.goalSecondsInForce))
    .put("trackCompleted", record.trackCompleted)
    .put("markComplete", record.markComplete)
    .toString()
}
