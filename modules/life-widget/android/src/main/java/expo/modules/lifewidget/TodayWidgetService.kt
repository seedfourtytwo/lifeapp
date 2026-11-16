package expo.modules.lifewidget

import android.content.Context
import android.content.Intent
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

  /** habit, counter, todo, label. */
  override fun getViewTypeCount(): Int = 4

  override fun getItemId(position: Int): Long = rows.getOrNull(position)?.key?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds(): Boolean = true

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewAt(position: Int): RemoteViews {
    return when (val row = rows.getOrNull(position)) {
      is WidgetRow.Habit -> habitView(row)
      is WidgetRow.Counter -> counterView(row)
      is WidgetRow.Todo -> todoView(row)
      is WidgetRow.TodosLabel -> labelView()
      null -> labelView()
    }
  }

  private fun fillIn(kind: String): Intent =
    Intent()
      .putExtra(WidgetActions.EXTRA_TAP_KIND, kind)
      .putExtra(WidgetActions.EXTRA_DATE, date)

  private fun habitView(row: WidgetRow.Habit): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_habit)
    val settled = row.state != HabitRowState.OPEN
    val disc = when (row.state) {
      HabitRowState.DONE -> R.drawable.life_widget_disc_done
      HabitRowState.SKIPPED -> R.drawable.life_widget_disc_skipped
      HabitRowState.OPEN -> if (row.timer) R.drawable.life_widget_disc_timer else R.drawable.life_widget_disc_open
    }
    views.setImageViewResource(R.id.row_disc, disc)

    // Two text views, one per colour, so the host resolves the colour resource
    // (and follows a theme change) rather than us baking in an int.
    views.setTextViewText(R.id.row_name, row.name)
    views.setTextViewText(R.id.row_name_settled, row.name)
    views.setViewVisibility(R.id.row_name, if (settled) View.GONE else View.VISIBLE)
    views.setViewVisibility(R.id.row_name_settled, if (settled) View.VISIBLE else View.GONE)

    if (row.timer) {
      val target = row.timerTargetMinutes
      val label = if (target != null) {
        context.getString(R.string.life_widget_timer_progress, row.timerMinutes, target)
      } else {
        context.getString(R.string.life_widget_timer_minutes, row.timerMinutes)
      }
      views.setTextViewText(R.id.row_meta, label)
      views.setViewVisibility(R.id.row_meta, View.VISIBLE)
      views.setOnClickFillInIntent(R.id.row_root, fillIn(WidgetActions.TAP_OPEN_APP))
      views.setContentDescription(R.id.row_root, row.name)
    } else {
      views.setViewVisibility(R.id.row_meta, View.GONE)
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

  private fun counterView(row: WidgetRow.Counter): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_row_counter)
    views.setTextViewText(R.id.row_name, row.name)
    val total = TodayRules.formatNumber(row.total)
    views.setTextViewText(R.id.row_total, if (row.target != null) "$total/${row.target}" else total)

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

  private fun labelView(): RemoteViews = RemoteViews(context.packageName, R.layout.life_widget_row_label)
}
