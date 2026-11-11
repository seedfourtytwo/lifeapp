package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The rules the widget works out without the app, held to the very cases
 * `__tests__/widgetRuleFixtures.test.ts` runs against the TypeScript rules.
 * The words come from the module's own `strings.xml`, English and French.
 */
class WidgetRuleFixturesTest {
  private fun fixture(name: String) = JSONObject(File("../fixtures/$name").readText())

  private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map(::getJSONObject)

  private fun rule(json: JSONObject): DoneRule = when (json.getString("kind")) {
    "check_off" -> DoneRule.CheckOff
    "timer" -> {
      val goal = json.getJSONObject("goal")
      DoneRule.Timer(
        when (goal.getString("type")) {
          "seconds" -> TimerGoal.Seconds(goal.getInt("seconds"))
          "play_once" -> TimerGoal.PlayOnce(goal.getInt("trackSeconds"))
          else -> TimerGoal.Open
        },
      )
    }
    "counter" -> DoneRule.Counter(if (json.isNull("target")) null else json.getDouble("target"))
    else -> DoneRule.Commitment
  }

  private fun schedule(json: JSONObject): Schedule = when (json.getString("type")) {
    "daily" -> Schedule.Daily
    "weekdays" -> Schedule.Weekdays(json.getJSONArray("days").let { days -> (0 until days.length()).map(days::getInt).toSet() })
    else -> Schedule.EveryNDays(json.getInt("interval"), LocalDate.parse(json.getString("anchorDate")))
  }

  @Test
  fun theDoneRule() {
    for (case in fixture("day-outcome.json").getJSONArray("cases").objects()) {
      val facts = case.getJSONObject("facts")
      val outcome = DayRules.outcome(
        rule(case.getJSONObject("rule")),
        DayFacts(facts.getDouble("total"), facts.getBoolean("trackCompleted"), facts.getBoolean("markedComplete")),
      )
      assertEquals(case.getString("name"), case.getBoolean("done"), outcome.done)
      assertEquals(case.getString("name"), case.getString("reason"), outcome.reason.wire)
    }
  }

  @Test
  fun dueToday() {
    for (case in fixture("due-today.json").getJSONArray("cases").objects()) {
      assertEquals(
        case.getString("name"),
        case.getBoolean("due"),
        DayRules.isDue(schedule(case.getJSONObject("schedule")), LocalDate.parse(case.getString("date"))),
      )
    }
  }

  @Test
  fun lampsAndTheOwnLine() {
    val lamps = fixture("lamps.json")
    val clearSince = Instant.parse(lamps.getString("clearSince")).toEpochMilli()
    fun at(hours: Double) = clearSince + (hours * 3_600_000).toLong()
    for (case in lamps.getJSONArray("cases").objects()) {
      val now = at(case.getDouble("hoursAfter"))
      assertEquals("${case.getDouble("hoursAfter")} h", case.getInt("lampsPassed"), Lamps.passed(clearSince, now))
      assertEquals("${case.getDouble("hoursAfter")} h", case.getLong("nextLampHours"), Lamps.next(clearSince, now).hours)
    }
    val own = lamps.getJSONObject("ownLines")
    val lines = own.getJSONArray("lines").let { array -> (0 until array.length()).map(array::getString) }
    for (case in own.getJSONArray("cases").objects()) {
      assertEquals(case.getString("shown"), Lamps.ownLine(lines, clearSince, at(case.getDouble("hoursAfter"))))
    }
    assertEquals(null, Lamps.ownLine(emptyList(), clearSince, at(100.0)))
  }

  /** `name` → text, from one folder's `strings.xml`. */
  private fun strings(folder: String): Map<String, String> {
    val document = DocumentBuilderFactory.newInstance().newDocumentBuilder()
      .parse(File("src/main/res/$folder/strings.xml"))
    val nodes = document.getElementsByTagName("string")
    return (0 until nodes.length).associate { index ->
      val node = nodes.item(index)
      node.attributes.getNamedItem("name").nodeValue to node.textContent
    }
  }

  private fun words(strings: Map<String, String>, parts: ClearTime): String = when (parts) {
    is ClearTime.Minutes -> strings.getValue("life_core_widget_clear_minutes").format(Locale.ROOT, parts.minutes)
    is ClearTime.HoursMinutes ->
      strings.getValue("life_core_widget_clear_hours_minutes").format(Locale.ROOT, parts.hours, parts.minutes)
    is ClearTime.DaysHours -> strings.getValue("life_core_widget_clear_days_hours").format(Locale.ROOT, parts.days, parts.hours)
  }

  private fun words(strings: Map<String, String>, label: LampLabel): String = when (label) {
    is LampLabel.Hours -> strings.getValue("life_core_widget_lamp_hours").format(Locale.ROOT, label.hours)
    is LampLabel.Days -> strings.getValue("life_core_widget_lamp_days").format(Locale.ROOT, label.days)
  }

  @Test
  fun timeClearAndLampLabelsInEnglishAndFrench() {
    val fixture = fixture("clear-time.json")
    for ((language, folder) in listOf("en" to "values", "fr" to "values-fr")) {
      val strings = strings(folder)
      for (case in fixture.getJSONArray("clearTime").objects()) {
        assertEquals(case.getString(language), words(strings, ClearTime.of(case.getLong("elapsedMs"))))
      }
      for (case in fixture.getJSONArray("lampLabels").objects()) {
        assertEquals(case.getString(language), words(strings, LampLabel.of(case.getLong("hours"))))
      }
    }
  }
}
