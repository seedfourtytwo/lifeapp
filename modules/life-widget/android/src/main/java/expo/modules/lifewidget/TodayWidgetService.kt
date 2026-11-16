package expo.modules.lifewidget

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/** Serves the widget's list. Declared in ":widget" (it reads the DB); see WidgetDb. */
class TodayWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TodayWidgetFactory(applicationContext)
}

internal class TodayWidgetFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var rows: List<WidgetRow> = emptyList()
  private var date: String = ""

  override fun onCreate() {}

  /** Runs on a binder thread, where blocking work is allowed. */
  override fun onDataSetChanged() {
    rows = try {
      when (val snapshot = WidgetDb.loadSnapshot(context)) {
        is WidgetSnapshot.Ready -> {
          date = snapshot.today.toString()
          snapshot.model.rows
        }
        is WidgetSnapshot.NoDatabase -> emptyList()
      }
    } catch (e: Exception) {
      Log.w("LifeWidget", "Could not load widget rows", e)
      emptyList()
    }
  }

  override fun onDestroy() {
    rows = emptyList()
  }

  override fun getCount(): Int = rows.size

  /** item (habit or counter), todo, label. */
  override fun getViewTypeCount(): Int = 3

  override fun getItemId(position: Int): Long = rows.getOrNull(position)?.key?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds(): Boolean = true

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewAt(position: Int): RemoteViews {
    return when (val row = rows.getOrNull(position)) {
      is WidgetRow.Habit -> habitView(row)
      is WidgetRow.Counter -> counterView(row)
      is WidgetRow.Todo -> todoView(row)
      is WidgetRow.Label -> labelView(row.section)
      null -> labelView(Section.HABITS)
    }
  }

  private fun fillIn(kind: String): Intent =
    Intent()
      .putExtra(WidgetActions.EXTRA_TAP_KIND, kind)
      .putExtra(WidgetActions.EXTRA_DATE, date)

  private fun habitView(row: WidgetRow.Habit): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_item)
    val settled = row.state != HabitRowState.OPEN
    // Finished rows lose their card, so what is left to do stands out.
    val runningSince = row.runningSinceMs
    val background = when {
      runningSince != null -> R.drawable.life_widget_card_running
      settled -> 0
      else -> R.drawable.life_widget_card
    }
    views.setInt(R.id.row_root, "setBackgroundResource", background)
    val disc = when {
      runningSince != null -> R.drawable.life_widget_disc_stop
      row.state == HabitRowState.DONE -> R.drawable.life_widget_disc_done
      row.state == HabitRowState.SKIPPED -> R.drawable.life_widget_disc_skipped
      // The play disc only where a tap starts the widget timer.
      row.canRun -> R.drawable.life_widget_disc_timer
      else -> R.drawable.life_widget_disc_open
    }
    views.setImageViewResource(R.id.row_disc, disc)

    setName(views, row.name, settled)

    if (row.timer) {
      val target = row.timerTargetMinutes
      val label = if (target != null) {
        context.getString(R.string.life_widget_timer_progress, row.timerMinutes, target)
      } else {
        context.getString(R.string.life_widget_timer_minutes, row.timerMinutes)
      }
      views.setTextViewText(R.id.row_meta, label)
      views.setViewVisibility(R.id.row_meta, View.VISIBLE)
      if (target != null && target > 0) {
        views.setProgressBar(R.id.row_progress, target, row.timerMinutes.coerceAtMost(target), false)
        views.setViewVisibility(R.id.row_progress, View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.row_progress, View.GONE)
      }
      if (row.canRun) {
        views.setOnClickFillInIntent(
          R.id.row_root,
          fillIn(WidgetActions.TAP_TIMER_TOGGLE).putExtra(WidgetActions.EXTRA_ID, row.id),
        )
        views.setContentDescription(
          R.id.row_root,
          context.getString(
            if (runningSince != null) R.string.life_widget_stop_timer_a11y else R.string.life_widget_start_timer_a11y,
            row.name,
          ),
        )
      } else {
        views.setOnClickFillInIntent(R.id.row_root, fillIn(WidgetActions.TAP_NONE))
        views.setContentDescription(R.id.row_root, row.name)
      }
      if (runningSince != null) {
        // The chronometer counts from a base on the uptime clock; ours is wall-clock.
        val base = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - runningSince)
        views.setChronometer(R.id.row_clock, base, null, true)
        views.setViewVisibility(R.id.row_clock, View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.row_clock, View.GONE)
      }
      val buttons = intArrayOf(R.id.row_button_1, R.id.row_button_2)
      for ((index, buttonId) in buttons.withIndex()) {
        // While the timer runs the clock takes the buttons' place.
        val minutes = if (runningSince != null) null else row.quickMinutes.getOrNull(index)
        if (minutes == null) {
          views.setViewVisibility(buttonId, View.GONE)
          continue
        }
        val label = "+$minutes"
        views.setViewVisibility(buttonId, View.VISIBLE)
        views.setTextViewText(buttonId, label)
        views.setContentDescription(buttonId, context.getString(R.string.life_widget_log_minutes_a11y, minutes, row.name))
        views.setOnClickFillInIntent(
          buttonId,
          fillIn(WidgetActions.TAP_TIMER_LOG)
            .putExtra(WidgetActions.EXTRA_ID, row.id)
            .putExtra(WidgetActions.EXTRA_MINUTES, minutes),
        )
      }
    } else {
      views.setViewVisibility(R.id.row_button_1, View.GONE)
      views.setViewVisibility(R.id.row_button_2, View.GONE)
      views.setViewVisibility(R.id.row_clock, View.GONE)
      views.setViewVisibility(R.id.row_meta, View.GONE)
      views.setViewVisibility(R.id.row_progress, View.GONE)
      val wantDone = row.state != HabitRowState.DONE
      views.setOnClickFillInIntent(
        R.id.row_root,
        fillIn(WidgetActions.TAP_HABIT)
          .putExtra(WidgetActions.EXTRA_ID, row.id)
          .putExtra(WidgetActions.EXTRA_WANT_DONE, wantDone),
      )
      views.setContentDescription(
        R.id.row_root,
        context.getString(
          if (wantDone) R.string.life_widget_mark_done_a11y else R.string.life_widget_mark_not_done_a11y,
          row.name,
        ),
      )
    }
    return views
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
    views.setViewVisibility(R.id.row_clock, View.GONE)

    val total = TodayRules.formatNumber(row.total)
    val target = row.target
    views.setTextViewText(R.id.row_meta, if (target != null) "$total / $target" else total)
    views.setViewVisibility(R.id.row_meta, View.VISIBLE)
    if (target != null && target > 0) {
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
        fillIn(WidgetActions.TAP_COUNTER)
          .putExtra(WidgetActions.EXTRA_ID, row.id)
          .putExtra(WidgetActions.EXTRA_INCREMENT, increment),
      )
    }
    return views
  }

  private fun todoView(row: WidgetRow.Todo): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_todo)
    views.setTextViewText(R.id.row_name, row.title)
    views.setContentDescription(R.id.row_box, context.getString(R.string.life_widget_complete_todo_a11y, row.title))
    views.setOnClickFillInIntent(
      R.id.row_box,
      fillIn(WidgetActions.TAP_TODO).putExtra(WidgetActions.EXTRA_ID, row.id),
    )
    return views
  }

  private fun labelView(section: Section): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_label)
    views.setTextViewText(
      R.id.row_label,
      context.getString(
        when (section) {
          Section.HABITS -> R.string.life_widget_label_habits
          Section.COUNTERS -> R.string.life_widget_label_counters
          Section.TODOS -> R.string.life_widget_label_todos
          Section.DONE -> R.string.life_widget_label_done
        },
      ),
    )
    return views
  }
}
