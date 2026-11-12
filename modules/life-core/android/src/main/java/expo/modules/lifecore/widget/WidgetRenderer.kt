package expo.modules.lifecore.widget

import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import expo.modules.lifecore.R
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * Draws a [WidgetFrame] as RemoteViews: one XML layout per state, texts
 * from this module's strings, the road painted into a bitmap, live clocks
 * as Chronometers. Labels come only from the frame's [Label]s, so a locked
 * phone's frame has no real name to show.
 *
 * Bitmaps: the road is at most [ROAD_MAX_PX] wide (about 1.1 MB at the
 * lock-screen size), icons a few KB; RemoteViews allows
 * 6 × screen width × screen height bytes (about 15 MB on this phone).
 */
class WidgetRenderer(private val context: Context) {
  private val density = context.resources.displayMetrics.density

  fun render(frame: WidgetFrame<Label>, widthDp: Int, heightDp: Int): RemoteViews = when (val view = frame.view) {
    is WidgetView.Timer -> timer(view)
    is WidgetView.Riding -> ride(view, widthDp, heightDp)
    is WidgetView.Home -> home(view, widthDp, heightDp)
    WidgetView.Empty -> empty()
  }

  private fun views(layout: Int) = RemoteViews(context.packageName, layout).apply {
    openApp()?.let { setOnClickPendingIntent(R.id.life_core_widget_root, it) }
  }

  private fun openApp(): PendingIntent? = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
    PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun RemoteViews.tap(id: Int, tap: Tap) = setOnClickPendingIntent(id, WidgetActionReceiver.pendingIntent(context, tap))

  private fun RemoteViews.show(id: Int, shown: Boolean) = setViewVisibility(id, if (shown) View.VISIBLE else View.GONE)

  /** The label's words: a lock-screen name on a locked phone, the real name on the home screen; null for an icon only. */
  private fun words(label: Label): String? = when (label) {
    is NeutralLabel -> label.lockScreenName
    is NamedLabel -> label.name
  }

  /** What a screen reader says for it: its words, or a neutral "Next". */
  private fun spoken(label: Label): String = words(label) ?: context.getString(R.string.life_core_widget_next)

  private fun RemoteViews.icon(id: Int, key: String?, sizeDp: Int) {
    val bitmap = key?.let { TrackerIcons.bitmap(context, it, (sizeDp * density).roundToInt()) }
    if (bitmap == null) show(id, false) else setImageViewBitmap(id, bitmap).also { show(id, true) }
  }

  private fun clearWords(clear: ClearTime): String = when (clear) {
    is ClearTime.Minutes -> context.getString(R.string.life_core_widget_clear_minutes, clear.minutes)
    is ClearTime.HoursMinutes -> context.getString(R.string.life_core_widget_clear_hours_minutes, clear.hours, clear.minutes)
    is ClearTime.DaysHours -> context.getString(R.string.life_core_widget_clear_days_hours, clear.days, clear.hours)
  }

  private fun lampWords(lamp: LampLabel): String = when (lamp) {
    is LampLabel.Hours -> context.getString(R.string.life_core_widget_lamp_hours, lamp.hours)
    is LampLabel.Days -> context.getString(R.string.life_core_widget_lamp_days, lamp.days)
  }

  private fun amount(value: Double): String =
    if (value == Math.floor(value)) value.toLong().toString() else value.toString()

  private fun road(road: Road, widthDp: Int, heightDp: Int): Bitmap {
    val width = minOf((widthDp * density).roundToInt(), ROAD_MAX_PX).coerceAtLeast(1)
    val height = (width.toFloat() * heightDp / widthDp).roundToInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    RoadPainter.paint(Canvas(bitmap), RoadScene.shapes(road, width, height))
    return bitmap
  }

  private fun home(view: WidgetView.Home<Label>, widthDp: Int, heightDp: Int): RemoteViews = views(R.layout.life_core_widget_home).apply {
    when (val top = view.top) {
      is HomeTop.Clear -> {
        setTextViewText(R.id.life_core_widget_home_big, clearWords(top.clear))
        setTextViewText(R.id.life_core_widget_home_big_label, top.lockScreenName)
        setTextViewText(R.id.life_core_widget_home_side, "${top.done} / ${top.due}")
        setTextViewText(R.id.life_core_widget_home_side_label, context.getString(R.string.life_core_widget_today))
      }
      is HomeTop.Count -> {
        setTextViewText(R.id.life_core_widget_home_big, "${top.done} / ${top.due}")
        setTextViewText(R.id.life_core_widget_home_big_label, context.getString(R.string.life_core_widget_today))
        show(R.id.life_core_widget_home_side, top.bestStreak != null)
        show(R.id.life_core_widget_home_side_label, top.bestStreak != null)
        top.bestStreak?.let {
          setTextViewText(R.id.life_core_widget_home_side, it.toString())
          setTextViewText(R.id.life_core_widget_home_side_label, context.getString(R.string.life_core_widget_in_a_row))
        }
      }
    }
    setImageViewBitmap(R.id.life_core_widget_home_road, road(view.road, widthDp - CONTENT_INSET_DP, HOME_ROAD_DP))
    val note = view.note
    show(R.id.life_core_widget_home_note, note != null)
    note?.let {
      val lamp = context.getString(R.string.life_core_widget_note, lampWords(it.lamp), clearWords(it.until))
      val ridden = context.resources.getQuantityString(R.plurals.life_core_widget_ridden_out, it.riddenOut, it.riddenOut)
      setTextViewText(R.id.life_core_widget_home_note, "$lamp · $ridden")
    }
    next(view.next)
    tap(R.id.life_core_widget_home_urge, Tap.Urge)
    setContentDescription(R.id.life_core_widget_home_urge, context.getString(R.string.life_core_widget_urge_a11y))
  }

  private fun RemoteViews.next(next: NextUp<Label>) {
    when (next) {
      is NextUp.Action -> {
        icon(R.id.life_core_widget_home_next_icon, next.label.icon, NEXT_ICON_DP)
        val text = words(next.label) ?: if (next.label.icon == null) context.getString(R.string.life_core_widget_next) else ""
        setTextViewText(R.id.life_core_widget_home_next_text, text)
        setTextViewTextSize(R.id.life_core_widget_home_next_text, TypedValue.COMPLEX_UNIT_SP, 15f)
        show(R.id.life_core_widget_home_next_button, true)
        val button = next.button
        val (tap, spoken) = when (button) {
          is NextButton.Play -> Tap.StartTimer(button.trackerId) to context.getString(R.string.life_core_widget_start_a11y, spoken(next.label))
          is NextButton.Tick -> Tap.Tick(button.trackerId) to context.getString(R.string.life_core_widget_tick_a11y, spoken(next.label))
          is NextButton.Add -> Tap.Add(button.trackerId, button.amount) to
            context.getString(R.string.life_core_widget_add_a11y, amount(button.amount), spoken(next.label))
        }
        show(R.id.life_core_widget_home_next_amount, button is NextButton.Add)
        show(R.id.life_core_widget_home_next_glyph, button !is NextButton.Add)
        when (button) {
          is NextButton.Play -> setImageViewResource(R.id.life_core_widget_home_next_glyph, R.drawable.life_core_widget_play)
          is NextButton.Tick -> setImageViewResource(R.id.life_core_widget_home_next_glyph, R.drawable.life_core_widget_tick)
          is NextButton.Add -> setTextViewText(R.id.life_core_widget_home_next_amount, "+${amount(button.amount)}")
        }
        tap(R.id.life_core_widget_home_next_button, tap)
        setContentDescription(R.id.life_core_widget_home_next_button, spoken)
      }
      is NextUp.OwnLine -> quietNext(next.text, OWN_LINE_SP)
      NextUp.AllDone -> quietNext(context.getString(R.string.life_core_widget_all_done), 15f)
    }
  }

  /** His own line (Light, a size up) or "nothing left": no button beside it. */
  private fun RemoteViews.quietNext(text: String, sizeSp: Float) {
    show(R.id.life_core_widget_home_next_icon, false)
    show(R.id.life_core_widget_home_next_button, false)
    setTextViewText(R.id.life_core_widget_home_next_text, text)
    setTextViewTextSize(R.id.life_core_widget_home_next_text, TypedValue.COMPLEX_UNIT_SP, sizeSp)
  }

  private fun timer(view: WidgetView.Timer<Label>): RemoteViews = views(R.layout.life_core_widget_timer).apply {
    icon(R.id.life_core_widget_timer_icon, view.label.icon, TIMER_ICON_DP)
    val name = words(view.label) ?: if (view.label.icon == null) context.getString(R.string.life_core_timer_public_title) else ""
    setTextViewText(
      R.id.life_core_widget_timer_name,
      if (view.running || name.isEmpty()) name else context.getString(R.string.life_core_widget_paused, name),
    )
    setChronometer(R.id.life_core_widget_timer_clock, SystemClock.elapsedRealtime() - view.activeMs, null, view.running)
    val goal = view.goalMs
    show(R.id.life_core_widget_timer_goal, goal != null)
    show(R.id.life_core_widget_timer_progress, goal != null)
    goal?.let {
      setTextViewText(R.id.life_core_widget_timer_goal, context.getString(R.string.life_core_timer_goal, clock(it / 1000)))
      setProgressBar(R.id.life_core_widget_timer_progress, PROGRESS_MAX, (PROGRESS_MAX * view.activeMs / it).toInt().coerceAtMost(PROGRESS_MAX), false)
    }
    setImageViewResource(
      R.id.life_core_widget_timer_toggle_glyph,
      if (view.running) R.drawable.life_core_widget_pause else R.drawable.life_core_widget_play,
    )
    setContentDescription(
      R.id.life_core_widget_timer_toggle,
      context.getString(if (view.running) R.string.life_core_timer_pause else R.string.life_core_timer_resume),
    )
    tap(R.id.life_core_widget_timer_toggle, if (view.running) Tap.Pause else Tap.Resume)
    tap(R.id.life_core_widget_timer_discard, Tap.Discard)
    tap(R.id.life_core_widget_timer_done, Tap.Done)
  }

  private fun ride(view: WidgetView.Riding<Label>, widthDp: Int, heightDp: Int): RemoteViews = views(R.layout.life_core_widget_ride).apply {
    val leftMs = maxOf(0L, view.ride.endsAtMs - System.currentTimeMillis())
    setChronometer(R.id.life_core_widget_ride_clock, SystemClock.elapsedRealtime() + leftMs, null, true)
    setChronometerCountDown(R.id.life_core_widget_ride_clock, true)
    setImageViewBitmap(R.id.life_core_widget_ride_road, road(view.road, widthDp - CONTENT_INSET_DP, RIDE_ROAD_DP))
    val instead = view.instead
    show(R.id.life_core_widget_ride_instead, instead != null)
    instead?.let {
      icon(R.id.life_core_widget_ride_instead_icon, it.label.icon, TIMER_ICON_DP)
      val minutes = it.goalSeconds?.let { seconds -> context.getString(R.string.life_core_widget_minutes, (seconds + 59) / 60) }
      val text = listOfNotNull(minutes, words(it.label)).joinToString(" · ")
      setTextViewText(R.id.life_core_widget_ride_instead_text, text.ifEmpty { context.getString(R.string.life_core_widget_start) })
      setContentDescription(R.id.life_core_widget_ride_instead, context.getString(R.string.life_core_widget_start_a11y, spoken(it.label)))
      tap(R.id.life_core_widget_ride_instead, Tap.StartTimer(it.trackerId))
    }
    setContentDescription(R.id.life_core_widget_ride_used, context.getString(R.string.life_core_widget_used_a11y))
    tap(R.id.life_core_widget_ride_used, Tap.Used(view.ride.urgeId))
  }

  private fun empty(): RemoteViews = views(R.layout.life_core_widget_empty).apply {
    setImageViewResource(R.id.life_core_widget_empty_icon, context.applicationInfo.icon)
  }

  companion object {
    private const val ROAD_MAX_PX = 1200
    /** The tile's side padding, both sides. */
    private const val CONTENT_INSET_DP = 40
    private const val HOME_ROAD_DP = 110
    private const val RIDE_ROAD_DP = 120
    private const val NEXT_ICON_DP = 22
    private const val TIMER_ICON_DP = 18
    private const val OWN_LINE_SP = 17f
    private const val PROGRESS_MAX = 1000

    fun clock(seconds: Long): String {
      val hours = seconds / 3600
      val minutes = (seconds % 3600) / 60
      val rest = seconds % 60
      return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, rest) else "%02d:%02d".format(minutes, rest)
    }
  }
}

/** Paints the road's flat shapes on an Android Canvas. */
object RoadPainter {
  fun paint(canvas: Canvas, shapes: List<RoadShape>) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    for (shape in shapes) {
      paint.color = when (shape) {
        is RoadShape.Polygon -> shape.color
        is RoadShape.Line -> shape.color
        is RoadShape.Circle -> shape.color
      }
      when (shape) {
        is RoadShape.Polygon -> {
          paint.style = Paint.Style.FILL
          val path = Path().apply {
            moveTo(shape.xs[0], shape.ys[0])
            for (index in 1 until shape.xs.size) lineTo(shape.xs[index], shape.ys[index])
            close()
          }
          canvas.drawPath(path, paint)
        }
        is RoadShape.Line -> {
          paint.style = Paint.Style.STROKE
          paint.strokeWidth = shape.width
          paint.strokeCap = Paint.Cap.BUTT
          canvas.drawLine(shape.x1, shape.y1, shape.x2, shape.y2, paint)
        }
        is RoadShape.Circle -> {
          paint.style = Paint.Style.FILL
          canvas.drawCircle(shape.cx, shape.cy, shape.radius, paint)
        }
      }
    }
  }
}

/** Tracker icons, cut from the app's icon font by `scripts/build-widget-icons.py`, drawn cream on clear. */
object TrackerIcons {
  private var codePoints: Map<String, Int>? = null

  private fun codePoints(context: Context): Map<String, Int> = codePoints ?: run {
    val json = JSONObject(context.resources.openRawResource(R.raw.life_core_tracker_icons).bufferedReader().use { it.readText() })
    json.keys().asSequence().associateWith(json::getInt).also { codePoints = it }
  }

  /** The icon as a bitmap, or null for a name the font does not hold (the app's own stickmen). */
  @Synchronized
  fun bitmap(context: Context, key: String, sizePx: Int): Bitmap? {
    val point = codePoints(context)[key] ?: return null
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      typeface = context.resources.getFont(R.font.life_core_tracker_icons)
      color = context.getColor(R.color.life_core_widget_cream)
      textSize = sizePx.toFloat()
      textAlign = Paint.Align.CENTER
    }
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val baseline = sizePx / 2f - (paint.descent() + paint.ascent()) / 2
    Canvas(bitmap).drawText(String(Character.toChars(point)), sizePx / 2f, baseline, paint)
    return bitmap
  }
}
