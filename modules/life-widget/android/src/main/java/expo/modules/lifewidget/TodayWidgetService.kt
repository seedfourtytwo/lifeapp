package expo.modules.lifewidget

import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Serves the widget's list below API 31 only. From API 31 the rows travel
 * inside the widget's own RemoteViews (see WidgetUpdater), so the header and
 * the list can never show two different moments. Declared in ":widget" (it
 * reads the DB); see WidgetDb.
 */
class TodayWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TodayWidgetFactory(applicationContext)
}

internal class TodayWidgetFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var rows: List<WidgetRow> = emptyList()
  private var builder = WidgetRows(context, "")

  override fun onCreate() {}

  /** Runs on a binder thread, where blocking work is allowed. */
  override fun onDataSetChanged() {
    rows = try {
      when (val snapshot = WidgetDb.loadSnapshot(context)) {
        is WidgetSnapshot.Ready -> {
          builder = WidgetRows(context, snapshot.today.toString())
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

  override fun getViewTypeCount(): Int = builder.viewTypeCount

  override fun getItemId(position: Int): Long = rows.getOrNull(position)?.let { builder.itemId(it) } ?: position.toLong()

  override fun hasStableIds(): Boolean = true

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewAt(position: Int): RemoteViews =
    builder.views(rows.getOrNull(position) ?: WidgetRow.Label(Section.HABITS))
}
