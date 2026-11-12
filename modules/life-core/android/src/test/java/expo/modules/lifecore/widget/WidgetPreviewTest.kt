package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerSession
import expo.modules.lifecore.widget.WidgetFixtures.FACE
import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.WATER
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.ms
import expo.modules.lifecore.widget.WidgetFixtures.paris
import expo.modules.lifecore.widget.WidgetFixtures.snapshot
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory

/**
 * Each widget state as a list of drawing steps, at the lock-screen box
 * (447 × 298 dp), in `build/widget-preview/`; `scripts/widget-preview.sh`
 * paints them to PNG (Java2D, which the Android unit tests cannot compile
 * against) in `docs/mockups/widget-preview/`.
 *
 * What is the phone's: the view model (`WidgetViews`), the road
 * (`RoadScene`), the tracker icon font, the colours and the English
 * strings, all read from the module. What is only close: the layout is the
 * XML's dp values placed by hand here, and the text is Inter where the
 * phone uses its system font (Roboto on GrapheneOS).
 */
class WidgetPreviewTest {
  private val out = File("build/widget-preview").apply { mkdirs() }

  private fun xml(path: String, tag: String): Map<String, String> {
    val nodes = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(File(path)).getElementsByTagName(tag)
    return (0 until nodes.length).associate { nodes.item(it).attributes.getNamedItem("name").nodeValue to nodes.item(it).textContent.trim() }
  }

  private val strings = xml("src/main/res/values/strings.xml", "string")
  private val colors = xml("src/main/res/values/life_core_widget_colors.xml", "color")
  private val icons = JSONObject(File("src/main/res/raw/life_core_tracker_icons.json").readText())

  private fun color(name: String): String = colors.getValue("life_core_widget_$name")

  private fun string(name: String, vararg args: Any): String = strings.getValue("life_core_widget_$name").format(Locale.ROOT, *args)

  /** Drawing steps in dp, top-left origin, for `scripts/widget-preview/Render.java`. */
  private class Steps {
    val all = JSONArray()

    fun add(op: String, vararg fields: Pair<String, Any?>) {
      all.put(JSONObject().put("op", op).apply { fields.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } })
    }
  }

  private fun page(name: String, steps: Steps) {
    val file = File(out, "$name.json")
    file.writeText(
      JSONObject()
        .put("widthDp", 447).put("heightDp", 298).put("density", 2.75)
        .put("colors", JSONObject(colors.mapKeys { it.key.removePrefix("life_core_widget_") }))
        .put("iconFont", File("src/main/res/font/life_core_tracker_icons.ttf").absolutePath)
        .put("steps", steps.all)
        .toString(2),
    )
  }

  private fun Steps.text(words: String, x: Float, top: Float, weight: String, size: Float, color: String, align: String = "start") =
    add("text", "text" to words, "x" to x, "top" to top, "weight" to weight, "size" to size, "color" to color(color), "align" to align)

  private fun Steps.road(road: Road, left: Float, top: Float, width: Float, height: Float) {
    val density = 2.75f
    val shapes = JSONArray()
    for (shape in RoadScene.shapes(road, (width * density).toInt(), (height * density).toInt())) {
      shapes.put(
        when (shape) {
          is RoadShape.Polygon -> JSONObject().put("kind", "polygon").put("xs", JSONArray(shape.xs.toList())).put("ys", JSONArray(shape.ys.toList())).put("color", shape.color)
          is RoadShape.Line -> JSONObject().put("kind", "line").put("x1", shape.x1).put("y1", shape.y1).put("x2", shape.x2).put("y2", shape.y2).put("width", shape.width).put("color", shape.color)
          is RoadShape.Circle -> JSONObject().put("kind", "circle").put("cx", shape.cx).put("cy", shape.cy).put("r", shape.radius).put("color", shape.color)
        },
      )
    }
    add("shapes", "left" to left, "top" to top, "shapes" to shapes)
  }

  private fun Steps.icon(key: String?, x: Float, top: Float, size: Float) {
    if (key != null && icons.has(key)) add("icon", "codePoint" to icons.getInt(key), "x" to x, "top" to top, "size" to size)
  }

  private fun clearWords(clear: ClearTime): String = when (clear) {
    is ClearTime.Minutes -> string("clear_minutes", clear.minutes)
    is ClearTime.HoursMinutes -> string("clear_hours_minutes", clear.hours, clear.minutes)
    is ClearTime.DaysHours -> string("clear_days_hours", clear.days, clear.hours)
  }

  private fun lampWords(lamp: LampLabel): String = when (lamp) {
    is LampLabel.Hours -> string("lamp_hours", lamp.hours)
    is LampLabel.Days -> string("lamp_days", lamp.days)
  }

  private fun home(name: String, view: WidgetView.Home<NeutralLabel>) {
    val steps = Steps()
    steps.add("tile")
    val right = 447f - 20f
    val (big, bigLabel, side, sideLabel) = when (val top = view.top) {
      is HomeTop.Clear -> listOf(clearWords(top.clear), top.lockScreenName, "${top.done} / ${top.due}", string("today"))
      is HomeTop.Count -> listOf("${top.done} / ${top.due}", string("today"), top.bestStreak?.toString().orEmpty(), string("in_a_row"))
    }
    // The XML's rows: 18 dp padding, 44 dp numerals, a 13 sp label; the side 10 dp lower.
    steps.text(big, 20f, 18f, "Light", 44f, "cream")
    steps.text(bigLabel, 20f, 73f, "Regular", 13f, "cream_quiet")
    steps.text(side, right, 28f, "Light", 28f, "cream", "end")
    steps.text(sideLabel, right, 63f, "Regular", 13f, "cream_quiet", "end")
    val rowTop = 298f - 16f - 52f
    val noteTop = rowTop - 8f - 18f
    view.note?.let {
      val ridden = if (it.riddenOut == 1) "1 ridden out" else "${it.riddenOut} ridden out"
      steps.text("${string("note", lampWords(it.lamp), clearWords(it.until))} · $ridden", 20f, noteTop, "Regular", 13f, "cream_quiet")
    }
    val roadBottom = if (view.note == null) noteTop + 18f else noteTop
    steps.road(view.road, 20f, 92f, 447f - 40f, roadBottom - 92f)
    steps.add("pillText", "right" to right, "top" to rowTop + 2, "height" to 48f, "minWidth" to 96f, "padding" to 20f, "text" to string("urge"), "ring" to color("violet"), "ringWidth" to 1.5f)
    when (val next = view.next) {
      is NextUp.Action -> {
        val buttonX = right - 96f - 12f - 52f
        steps.add("round", "x" to buttonX, "top" to rowTop, "size" to 52f, "ring" to color("hairline"), "ringWidth" to 1f, "afterPill" to true)
        when (val button = next.button) {
          is NextButton.Play -> steps.add("glyph", "kind" to "play", "cx" to buttonX + 26, "cy" to rowTop + 26, "size" to 22f, "afterPill" to true)
          is NextButton.Tick -> steps.add("glyph", "kind" to "tick", "cx" to buttonX + 26, "cy" to rowTop + 26, "size" to 22f, "afterPill" to true)
          is NextButton.Add -> steps.add(
            "text", "text" to "+${button.amount.toLong()}", "x" to buttonX + 26, "top" to rowTop + 16, "weight" to "Medium",
            "size" to 15f, "color" to color("cream"), "align" to "center", "afterPill" to true,
          )
        }
        var x = 20f
        if (next.label.icon != null) {
          steps.icon(next.label.icon, x, rowTop + 15, 22f)
          x += 32f
        }
        steps.text(next.label.lockScreenName ?: if (next.label.icon == null) string("next") else "", x, rowTop + 16, "Regular", 15f, "cream")
      }
      is NextUp.OwnLine -> steps.text(next.text, 20f, rowTop + 14, "Light", 17f, "cream")
      NextUp.AllDone -> steps.text(string("all_done"), 20f, rowTop + 16, "Regular", 15f, "cream")
    }
    page(name, steps)
  }

  private fun timer(name: String, view: WidgetView.Timer<NeutralLabel>) {
    val steps = Steps()
    steps.add("tile")
    val centre = 447f / 2
    val label = view.label.lockScreenName ?: strings.getValue("life_core_timer_public_title")
    steps.add(
      "iconText", "codePoint" to view.label.icon?.takeIf(icons::has)?.let(icons::getInt), "iconSize" to 18f, "gap" to 8f,
      "text" to if (view.running) label else string("paused", label), "cx" to centre, "top" to 18f, "weight" to "Medium", "size" to 14f,
      "color" to color("cream_quiet"),
    )
    steps.text(WidgetRenderer.clock(view.activeMs / 1000), centre, 66f, "Light", 64f, "cream", "center")
    view.goalMs?.let { goal ->
      steps.text(strings.getValue("life_core_timer_goal").format(Locale.ROOT, WidgetRenderer.clock(goal / 1000)), centre, 150f, "Regular", 13f, "cream_quiet", "center")
      steps.add("rrect", "x" to 48f, "top" to 178f, "width" to 447f - 96, "height" to 3f, "color" to color("track"))
      steps.add("rrect", "x" to 48f, "top" to 178f, "width" to (447f - 96) * minOf(1f, view.activeMs.toFloat() / goal), "height" to 3f, "color" to color("teal"))
    }
    val buttons = 298f - 18f - 64f
    steps.add("round", "x" to centre - 32 - 24 - 56, "top" to buttons + 4, "size" to 56f, "ring" to color("hairline"), "ringWidth" to 1f)
    steps.add("glyph", "kind" to "stop", "cx" to centre - 32 - 24 - 28, "cy" to buttons + 32, "size" to 20f)
    steps.add("round", "x" to centre - 32, "top" to buttons, "size" to 64f, "ring" to color("teal"), "ringWidth" to 1.5f)
    steps.add("glyph", "kind" to if (view.running) "pause" else "play", "cx" to centre, "cy" to buttons + 32, "size" to 24f)
    steps.add("round", "x" to centre + 32 + 24, "top" to buttons + 4, "size" to 56f, "ring" to color("hairline"), "ringWidth" to 1f)
    steps.add("glyph", "kind" to "check", "cx" to centre + 32 + 24 + 28, "cy" to buttons + 32, "size" to 22f)
    page(name, steps)
  }

  private fun ride(name: String, view: WidgetView.Riding<NeutralLabel>, nowMs: Long) {
    val steps = Steps()
    steps.add("tile")
    val centre = 447f / 2
    steps.text(string("ride_title"), centre, 18f, "Regular", 14f, "cream_quiet", "center")
    steps.text(WidgetRenderer.clock((view.ride.endsAtMs - nowMs + 999) / 1000), centre, 42f, "Light", 52f, "cream", "center")
    val rowTop = 298f - 16f - 48f
    steps.road(view.road, 20f, 104f, 447f - 40f, rowTop - 8f - 104f)
    val usedWidth = 72f
    steps.text(string("used"), 447f - 20f - usedWidth / 2, rowTop + 14, "Regular", 14f, "cream_quiet", "center")
    view.instead?.let {
      val pillWidth = 447f - 40f - 8f - usedWidth
      steps.add("pill", "x" to 20f, "top" to rowTop, "width" to pillWidth, "height" to 48f, "ring" to color("amber"), "ringWidth" to 1.5f)
      val words = listOfNotNull(it.goalSeconds?.let { seconds -> string("minutes", (seconds + 59) / 60) }, it.label.lockScreenName).joinToString(" · ")
      steps.add(
        "iconText", "codePoint" to it.label.icon?.takeIf(icons::has)?.let(icons::getInt), "iconSize" to 18f, "gap" to 8f,
        "text" to words, "cx" to 20f + pillWidth / 2, "top" to rowTop + 14, "weight" to "Medium", "size" to 15f, "color" to color("cream"),
      )
    }
    page(name, steps)
  }

  private fun keyguard(at: Long, lines: List<QueuedAction> = emptyList(), timer: TimerSession? = null, from: Snapshot = snapshot) =
    WidgetViews.build(from, timer, lines, at, paris, KeyguardLabels).view

  @Suppress("UNCHECKED_CAST")
  @Test
  fun writesEveryStateAtTheLockScreenSize() {
    val morning = ms("2026-03-10T06:12:00.000Z")
    home("home-morning", keyguard(morning) as WidgetView.Home<NeutralLabel>)

    val evening = ms("2026-03-10T20:04:00.000Z")
    val day = listOf(
      QueuedAction.TimerSessionDone("a", evening - 9000, march10, MEDITATION, 900, false, false),
      QueuedAction.CounterAdd("c", evening - 7000, march10, WATER, 3.0),
    )
    home("home-evening-icon-only", keyguard(evening, day) as WidgetView.Home<NeutralLabel>)
    val all = day + QueuedAction.HabitComplete("b", evening - 8000, march10, KEFIR) + QueuedAction.HabitComplete("d", evening - 6000, march10, FACE)
    home("home-all-done-own-line", keyguard(evening + 3_600_000, all) as WidgetView.Home<NeutralLabel>)

    val none = snapshot.copy(commitment = null, trackers = snapshot.trackers.filter { it.kind != TrackerKind.COMMITMENT })
    home("home-no-commitment", keyguard(morning, from = none) as WidgetView.Home<NeutralLabel>)

    val started = WidgetFixtures.timerSession().let { TimerSession.start(it.request, morning - 462_000, "2026-03-10", it.sessionId) }
    timer("timer-running", keyguard(morning, timer = started) as WidgetView.Timer<NeutralLabel>)
    timer("timer-paused", keyguard(morning, timer = started.pause(morning)) as WidgetView.Timer<NeutralLabel>)

    val urge = QueuedAction.UrgeLogged("e", evening, march10)
    ride("ride", keyguard(evening + 78_000, listOf(urge)) as WidgetView.Riding<NeutralLabel>, evening + 78_000)

    assertTrue(out.listFiles().orEmpty().count { it.extension == "json" } >= 7)
  }
}
