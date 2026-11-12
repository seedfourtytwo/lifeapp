package expo.modules.lifecore.reminders

import expo.modules.lifecore.widget.Schedule
import expo.modules.lifecore.widget.SnapshotJson
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.DateTimeException
import java.time.LocalTime

/**
 * `files/widget/reminders.json` (`ReminderPlanSchema`, `docs/widget-contract.md`):
 * what JavaScript hands the reminder scheduler whenever it changes.
 */
data class ReminderPlan(
  /** The Habit reminders switch is on and notifications were allowed when JavaScript wrote it. */
  val enabled: Boolean,
  /** `en` or `fr`: the app's language, for every native notification. */
  val language: String,
  val habits: List<PlanHabit>,
)

data class PlanHabit(
  val id: String,
  /** The real name: the private version only. */
  val name: String,
  /** What a locked phone hiding content shows; null keeps the reminder hidden there. */
  val lockScreenName: String?,
  val schedule: Schedule,
  /** Earliest first. */
  val reminderTimes: List<LocalTime>,
)

object ReminderPlanJson {
  const val VERSION = 1

  private fun JSONArray.strings(): List<String> = (0 until length()).map(::getString)

  private fun habit(json: JSONObject) = PlanHabit(
    id = json.getString("id"),
    name = json.getString("name"),
    lockScreenName = if (json.isNull("lockScreenName")) null else json.getString("lockScreenName"),
    schedule = SnapshotJson.schedule(json.getJSONObject("schedule")),
    reminderTimes = json.getJSONArray("reminderTimes").strings().map(LocalTime::parse).sorted(),
  )

  /** The plan, or null when the text is not one this build knows: then nothing reminds. */
  fun parse(text: String): ReminderPlan? = try {
    val json = JSONObject(text)
    if (json.getInt("version") != VERSION) {
      null
    } else {
      val habits = json.getJSONArray("habits")
      ReminderPlan(
        enabled = json.getBoolean("enabled"),
        language = json.getString("language"),
        habits = (0 until habits.length()).map { habit(habits.getJSONObject(it)) },
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
