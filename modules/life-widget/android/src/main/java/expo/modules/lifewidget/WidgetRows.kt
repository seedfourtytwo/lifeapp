package expo.modules.lifewidget

import android.content.Context
import android.content.Intent
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Turns the model's rows into list item views. Shared by the two ways the list
 * is filled: in one piece with the rest of the widget (API 31+, WidgetUpdater)
 * and through the adapter service on older phones (TodayWidgetService).
 *
 * `date` is the day the rows were built for; taps carry it so a tap on a row
 * drawn before midnight is not applied to the next day.
 */
internal class WidgetRows(private val context: Context, private val date: String) {
  /** item (habit or counter), todo, label. */
  val viewTypeCount: Int = 3

  fun itemId(row: WidgetRow): Long = row.key.hashCode().toLong()

  /**
   * For a position the host asks for after the list has shrunk under it. The
   * label layout with nothing in it: any row carrying words would read as a
   * real entry that cannot be tapped.
   */
  fun blank(): RemoteViews = RemoteViews(context.packageName, R.layout.life_widget_row_label)

  fun views(row: WidgetRow): RemoteViews = when (row) {
    is WidgetRow.Habit -> habitView(row)
    is WidgetRow.Counter -> counterView(row)
    is WidgetRow.Todo -> todoView(row)
    is WidgetRow.Label -> labelView(row.section)
  }

  private fun fillIn(kind: String, id: String? = null): Intent {
    val intent = Intent()
      .putExtra(WidgetActions.EXTRA_TAP_KIND, kind)
      .putExtra(WidgetActions.EXTRA_DATE, date)
    if (id != null) intent.putExtra(WidgetActions.EXTRA_ID, id)
    return intent
  }

  /**
   * Two text views, one per colour, so the host resolves the colour resource
   * (and follows a theme change) rather than us baking in an int.
   */
  private fun setName(views: RemoteViews, name: String, settled: Boolean) {
    views.setTextViewText(R.id.row_name, name)
    views.setTextViewText(R.id.row_name_settled, name)
    views.setViewVisibility(R.id.row_name, if (settled) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.row_name_settled, if (settled) View.VISIBLE else View.GONE)
  }

  /** One of the row's two icon buttons, or hidden when `icon` is null. */
  private fun setAction(views: RemoteViews, viewId: Int, icon: Int?, description: String?, tap: Intent?) {
    if (icon == null || tap == null) {
      views.setViewVisibility(viewId, View.GONE)
      return
    }
    views.setViewVisibility(viewId, View.VISIBLE)
    // The view is recycled between a timer's disc and a tick's ring: always state which.
    views.setInt(viewId, "setBackgroundResource", R.drawable.life_widget_button_round)
    views.setImageViewResource(viewId, icon)
    views.setContentDescription(viewId, description)
    views.setOnClickFillInIntent(viewId, tap)
  }

  /**
   * A row still to do is 68dp tall; a settled one is a slim line, so the list is
   * mostly what is left. The layout is shared and recycled: always state it.
   */
  private fun px(dp: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, context.resources.displayMetrics).toInt()

  private fun setHeight(views: RemoteViews, settled: Boolean) {
    val dp = if (settled) SETTLED_ROW_DP else OPEN_ROW_DP
    views.setInt(R.id.row_root, "setMinimumHeight", px(dp))
    // No room above and below a settled row's 56dp control, or the control alone keeps the row tall.
    val vertical = if (settled) 0 else px(ROW_PADDING_DP)
    views.setViewPadding(R.id.row_root, px(ROW_START_DP), vertical, px(ROW_PADDING_DP), vertical)
  }

  /**
   * "24:10 / 1:00:00" with what has been done in the bright colour and the goal
   * left quiet, so the eye lands on the number that moves. The text view's own
   * colour is the quiet one; a figure with no goal after it is left as it is.
   */
  private fun figureOverGoal(text: String): CharSequence {
    val slash = text.indexOf(" / ")
    if (slash < 0) return text
    val start = text.lastIndexOf("· ", slash).let { if (it < 0) 0 else it + 2 }
    return SpannableString(text).apply {
      setSpan(ForegroundColorSpan(context.getColor(R.color.life_widget_text)), start, slash, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
  }

  private fun habitView(row: WidgetRow.Habit): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_item)
    val settled = row.state != HabitRowState.OPEN
    val running = row.runningSinceMs != null
    val paused = row.pausedElapsedMs != null
    val ours = running && !row.inApp
    // Finished rows lose their card, so what is left to do stands out.
    val background = when {
      ours -> R.drawable.life_widget_card_running
      settled -> 0
      else -> R.drawable.life_widget_card
    }
    views.setInt(R.id.row_root, "setBackgroundResource", background)
    // A timer habit shows a stopwatch, not the ring: the ring means "tap to tick".
    val disc = when {
      running && !paused -> R.drawable.life_widget_tile_timer_running
      row.state == HabitRowState.SKIPPED -> R.drawable.life_widget_tile_skipped
      // A settled timer shows its tick here; a tick-off habit has it at the row's end already.
      row.state == HabitRowState.DONE && row.timer -> R.drawable.life_widget_tile_done
      row.state == HabitRowState.DONE -> R.drawable.life_widget_tile_daily_settled
      row.timer -> R.drawable.life_widget_tile_timer
      else -> R.drawable.life_widget_tile_daily
    }
    views.setImageViewResource(R.id.row_disc, disc)
    setName(views, row.name, settled)
    setHeight(views, settled)
    views.setViewVisibility(R.id.row_buttons, View.GONE)
    views.setViewVisibility(R.id.row_figure, View.GONE)
    views.setViewVisibility(R.id.row_progress_counter, View.GONE)
    views.setViewVisibility(R.id.row_figure_end, View.GONE)

    if (!row.timer) {
      views.setViewVisibility(R.id.row_meta, View.GONE)
      views.setViewVisibility(R.id.row_progress, View.GONE)
      setAction(views, R.id.row_action_1, null, null, null)
      val wantDone = row.state != HabitRowState.DONE
      val tap = fillIn(WidgetActions.TAP_HABIT, row.id).putExtra(WidgetActions.EXTRA_WANT_DONE, wantDone)
      val label = context.getString(
        if (wantDone) R.string.life_widget_mark_done_a11y else R.string.life_widget_mark_not_done_a11y,
        row.name,
      )
      // The tick sits where a timer has its play disc, so every row's control is in one
      // column; the row itself still ticks too, as a bigger target.
      views.setViewVisibility(R.id.row_action_2, View.VISIBLE)
      views.setInt(
        R.id.row_action_2,
        "setBackgroundResource",
        if (wantDone) R.drawable.life_widget_tick_open else R.drawable.life_widget_tick_done,
      )
      views.setImageViewResource(
        R.id.row_action_2,
        if (wantDone) R.drawable.life_widget_ic_none else R.drawable.life_widget_ic_check,
      )
      views.setContentDescription(R.id.row_action_2, label)
      views.setOnClickFillInIntent(R.id.row_action_2, tap)
      views.setOnClickFillInIntent(R.id.row_root, tap)
      views.setContentDescription(R.id.row_root, label)
      return views
    }

    // Today's time so far, as a clock that ticks while the timer runs: what is
    // already logged plus the running session, over the goal.
    val runningSince = row.runningSinceMs
    val pausedMs = row.pausedElapsedMs
    val sessionMs = when {
      runningSince == null -> 0L
      pausedMs != null -> pausedMs
      else -> (System.currentTimeMillis() - runningSince).coerceAtLeast(0)
    }
    val shownMs = row.loggedSeconds * 1000L + sessionMs
    val target = row.targetSeconds
    val status = when {
      row.inApp && paused -> context.getString(R.string.life_widget_paused_in_app)
      row.inApp -> context.getString(R.string.life_widget_running_in_app)
      paused -> context.getString(R.string.life_widget_paused)
      else -> null
    }
    // Plain text: a Chronometer does not tick inside a list item on the lock-screen
    // page. The habit the widget is timing is drawn outside the list (WidgetUpdater);
    // a timer the app is running has no figure here that could be trusted to move.
    val started = running || paused || row.inApp || row.loggedSeconds > 0
    val figure = TodayRules.timerFigure((shownMs / 1000).toInt(), target, started)
    val time = figure?.let {
      if (it.isGoal) context.getString(R.string.life_widget_goal, it.text) else it.text
    }
    val meta = when {
      status == null -> time
      time == null -> status
      row.inApp && !paused -> status
      else -> "$status · $time"
    }
    // A settled timer keeps one thing, its time, at the row's end where the control was.
    val settledTime = if (settled && status == null) figure?.takeUnless { it.isGoal }?.text?.substringBefore(" / ") else null
    if (settled && status == null) {
      views.setViewVisibility(R.id.row_meta, View.GONE)
      views.setTextViewText(R.id.row_figure_end, settledTime ?: "")
      views.setViewVisibility(R.id.row_figure_end, if (settledTime != null) View.VISIBLE else View.GONE)
    } else {
      views.setTextViewText(R.id.row_meta, meta?.let { figureOverGoal(it) } ?: "")
      views.setViewVisibility(R.id.row_meta, if (meta != null) View.VISIBLE else View.GONE)
    }
    // An empty bar on every untouched row is a row of nothing: the bar appears
    // with the first logged second, and then it means something.
    if (!settled && started && target != null && target > 0) {
      views.setProgressBar(R.id.row_progress, target, (shownMs / 1000).coerceAtMost(target.toLong()).toInt(), false)
      views.setViewVisibility(R.id.row_progress, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.row_progress, View.GONE)
    }

    // A timer running in the app is the app's to stop: its sound and its clock live
    // there. One the app has paused can be picked up here; the widget takes it over.
    if ((row.inApp && !paused) || !row.canRun) {
      views.setOnClickFillInIntent(R.id.row_root, fillIn(WidgetActions.TAP_NONE))
      views.setContentDescription(R.id.row_root, row.name)
      setAction(views, R.id.row_action_1, null, null, null)
      setAction(views, R.id.row_action_2, null, null, null)
      return views
    }

    val toggle = fillIn(WidgetActions.TAP_TIMER_TOGGLE, row.id)
    val stop = fillIn(WidgetActions.TAP_TIMER_STOP, row.id)
    val startLabel = context.getString(R.string.life_widget_start_timer_a11y, row.name)
    val stopLabel = context.getString(R.string.life_widget_stop_timer_a11y, row.name)
    val pauseLabel = context.getString(R.string.life_widget_pause_timer_a11y, row.name)
    val resumeLabel = context.getString(R.string.life_widget_resume_timer_a11y, row.name)
    // The row does what its first button does; the buttons say what that is.
    when {
      !running -> {
        setAction(views, R.id.row_action_1, null, null, null)
        setAction(views, R.id.row_action_2, R.drawable.life_widget_ic_play, startLabel, toggle)
        views.setContentDescription(R.id.row_root, startLabel)
      }
      // Paused, with or without a sound: resume it or end it.
      row.hasAudio || paused -> {
        val icon = if (paused) R.drawable.life_widget_ic_play else R.drawable.life_widget_ic_pause
        val label = if (paused) resumeLabel else pauseLabel
        setAction(views, R.id.row_action_1, icon, label, toggle)
        setAction(views, R.id.row_action_2, R.drawable.life_widget_ic_stop, stopLabel, stop)
        views.setContentDescription(R.id.row_root, label)
      }
      else -> {
        setAction(views, R.id.row_action_1, null, null, null)
        setAction(views, R.id.row_action_2, R.drawable.life_widget_ic_stop, stopLabel, stop)
        views.setContentDescription(R.id.row_root, stopLabel)
      }
    }
    views.setOnClickFillInIntent(R.id.row_root, toggle)
    return views
  }

  private fun counterView(row: WidgetRow.Counter): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_item)
    views.setInt(R.id.row_root, "setBackgroundResource", R.drawable.life_widget_card)
    views.setImageViewResource(
      R.id.row_disc,
      if (row.done) R.drawable.life_widget_tile_done else R.drawable.life_widget_tile_counter,
    )
    setName(views, row.name, settled = false)
    setHeight(views, settled = false)
    views.setViewVisibility(R.id.row_meta, View.GONE)
    views.setViewVisibility(R.id.row_progress, View.GONE)
    views.setViewVisibility(R.id.row_figure_end, View.GONE)
    // Same layout as a habit row, whose views are recycled: always state the row tap.
    views.setOnClickFillInIntent(R.id.row_root, fillIn(WidgetActions.TAP_NONE))
    views.setContentDescription(R.id.row_root, row.name)
    setAction(views, R.id.row_action_1, null, null, null)
    setAction(views, R.id.row_action_2, null, null, null)

    val total = TodayRules.formatNumber(row.total)
    val target = row.target
    views.setTextViewText(R.id.row_figure, figureOverGoal(if (target != null) "$total / $target" else total))
    views.setViewVisibility(R.id.row_figure, View.VISIBLE)
    // As on a habit row: an empty bar says nothing the figure has not said.
    if (target != null && target > 0 && row.total > 0) {
      views.setProgressBar(R.id.row_progress_counter, target, row.total.coerceIn(0.0, target.toDouble()).toInt(), false)
      views.setViewVisibility(R.id.row_progress_counter, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.row_progress_counter, View.GONE)
    }

    // One capsule for both steps; the rule between them only when there are two.
    views.setViewVisibility(R.id.row_buttons, if (row.increments.isEmpty()) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.row_button_rule, if (row.increments.size > 1) View.VISIBLE else View.GONE)
    val buttons = intArrayOf(R.id.row_button_1, R.id.row_button_2)
    for ((index, buttonId) in buttons.withIndex()) {
      val increment = row.increments.getOrNull(index)
      if (increment == null) {
        views.setViewVisibility(buttonId, View.GONE)
        continue
      }
      val label = "+${TodayRules.formatNumber(increment)}"
      views.setViewVisibility(buttonId, View.VISIBLE)
      views.setTextViewText(buttonId, label)
      views.setContentDescription(buttonId, context.getString(R.string.life_widget_add_a11y, label, row.name))
      views.setOnClickFillInIntent(
        buttonId,
        fillIn(WidgetActions.TAP_COUNTER, row.id).putExtra(WidgetActions.EXTRA_INCREMENT, increment),
      )
    }
    return views
  }

  private fun todoView(row: WidgetRow.Todo): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_todo)
    // Like a finished habit, a ticked todo loses its card.
    views.setInt(R.id.row_root, "setBackgroundResource", if (row.done) 0 else R.drawable.life_widget_card)
    views.setInt(
      R.id.row_box,
      "setBackgroundResource",
      if (row.done) R.drawable.life_widget_todo_done else R.drawable.life_widget_todo_open,
    )
    views.setImageViewResource(
      R.id.row_box,
      if (row.done) R.drawable.life_widget_ic_check else R.drawable.life_widget_ic_none,
    )
    setName(views, row.title, settled = row.done)

    val dueDate = row.dueDate?.let { TodayRules.parseDate(it) }
    val day = dueDate?.let { DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault()).format(it) } ?: ""
    val quiet = if (row.due == TodoDue.LATER) context.getString(R.string.life_widget_todo_due, day) else null
    val alert = when (row.due) {
      TodoDue.OVERDUE -> context.getString(R.string.life_widget_todo_overdue, day)
      TodoDue.TODAY -> context.getString(R.string.life_widget_todo_today)
      else -> null
    }
    views.setTextViewText(R.id.row_meta, quiet ?: "")
    views.setViewVisibility(R.id.row_meta, if (quiet != null) View.VISIBLE else View.GONE)
    views.setTextViewText(R.id.row_meta_alert, alert ?: "")
    views.setViewVisibility(R.id.row_meta_alert, if (alert != null) View.VISIBLE else View.GONE)

    // Only the box is the tap target: a todo is ticked on purpose, not by brushing the row.
    views.setContentDescription(
      R.id.row_box,
      context.getString(
        if (row.done) R.string.life_widget_reopen_todo_a11y else R.string.life_widget_complete_todo_a11y,
        row.title,
      ),
    )
    views.setOnClickFillInIntent(
      R.id.row_box,
      fillIn(WidgetActions.TAP_TODO, row.id).putExtra(WidgetActions.EXTRA_WANT_DONE, !row.done),
    )
    return views
  }

  private companion object {
    const val OPEN_ROW_DP = 68f
    const val SETTLED_ROW_DP = 48f
    const val ROW_START_DP = 12f
    const val ROW_PADDING_DP = 8f
  }

  private fun labelView(section: Section): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_label)
    views.setTextViewText(
      R.id.row_label,
      context.getString(
        when (section) {
          Section.NOW -> R.string.life_widget_label_now
          Section.TODOS -> R.string.life_widget_label_todos
          Section.DONE -> R.string.life_widget_label_done
        },
      ),
    )
    return views
  }
}
