package expo.modules.lifewidget

import android.content.Context
import android.content.Intent
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
    views.setImageViewResource(viewId, icon)
    views.setContentDescription(viewId, description)
    views.setOnClickFillInIntent(viewId, tap)
  }

  private fun hideTextButtons(views: RemoteViews) {
    views.setViewVisibility(R.id.row_button_1, View.GONE)
    views.setViewVisibility(R.id.row_button_2, View.GONE)
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
      running && !paused -> R.drawable.life_widget_disc_timer_running
      row.state == HabitRowState.DONE -> R.drawable.life_widget_disc_done
      row.state == HabitRowState.SKIPPED -> R.drawable.life_widget_disc_skipped
      row.timer -> R.drawable.life_widget_disc_timer
      else -> R.drawable.life_widget_disc_open
    }
    views.setImageViewResource(R.id.row_disc, disc)
    setName(views, row.name, settled)
    hideTextButtons(views)

    if (!row.timer) {
      views.setViewVisibility(R.id.row_meta, View.GONE)
      views.setViewVisibility(R.id.row_progress, View.GONE)
      setAction(views, R.id.row_action_1, null, null, null)
      setAction(views, R.id.row_action_2, null, null, null)
      val wantDone = row.state != HabitRowState.DONE
      views.setOnClickFillInIntent(
        R.id.row_root,
        fillIn(WidgetActions.TAP_HABIT, row.id).putExtra(WidgetActions.EXTRA_WANT_DONE, wantDone),
      )
      views.setContentDescription(
        R.id.row_root,
        context.getString(
          if (wantDone) R.string.life_widget_mark_done_a11y else R.string.life_widget_mark_not_done_a11y,
          row.name,
        ),
      )
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
    views.setTextViewText(R.id.row_meta, meta ?: "")
    views.setViewVisibility(R.id.row_meta, if (meta != null) View.VISIBLE else View.GONE)
    // An empty bar on every untouched row is a row of nothing: the bar appears
    // with the first logged second, and then it means something.
    if (started && target != null && target > 0) {
      views.setProgressBar(R.id.row_progress, target, (shownMs / 1000).coerceAtMost(target.toLong()).toInt(), false)
      views.setViewVisibility(R.id.row_progress, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.row_progress, View.GONE)
    }

    // A timer the app is running is the app's to stop: two timers would log the time twice.
    if (row.inApp || !row.canRun) {
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
      row.hasAudio -> {
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
      if (row.done) R.drawable.life_widget_disc_done else R.drawable.life_widget_disc_counter,
    )
    setName(views, row.name, settled = false)
    // Same layout as a habit row, whose views are recycled: always state the row tap.
    views.setOnClickFillInIntent(R.id.row_root, fillIn(WidgetActions.TAP_NONE))
    views.setContentDescription(R.id.row_root, row.name)
    setAction(views, R.id.row_action_1, null, null, null)
    setAction(views, R.id.row_action_2, null, null, null)

    val total = TodayRules.formatNumber(row.total)
    val target = row.target
    views.setTextViewText(R.id.row_meta, if (target != null) "$total / $target" else total)
    views.setViewVisibility(R.id.row_meta, View.VISIBLE)
    // As on a habit row: an empty bar says nothing the figure has not said.
    if (target != null && target > 0 && row.total > 0) {
      views.setProgressBar(R.id.row_progress, target, row.total.coerceIn(0.0, target.toDouble()).toInt(), false)
      views.setViewVisibility(R.id.row_progress, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.row_progress, View.GONE)
    }

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
    views.setImageViewResource(
      R.id.row_box_icon,
      if (row.done) R.drawable.life_widget_disc_done else R.drawable.life_widget_todo_box,
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
