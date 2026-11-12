package expo.modules.lifecore.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import expo.modules.lifecore.TimerCore
import java.time.ZoneId

/**
 * The lock-screen widget (`widgetCategory="home_screen|keyguard"`). It draws
 * from the snapshot, the timer core and the queue lines not yet applied,
 * so a tap shows at once with the app not running.
 */
class LifeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    LifeWidget.refresh(context, ids)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    LifeWidget.refresh(context, intArrayOf(id))
  }
}

object LifeWidget {
  /** The lock-screen page's one box (measured on the Pixel 9); the home screen is given the same. */
  private const val BOX_WIDTH_DP = 447
  private const val BOX_HEIGHT_DP = 298

  private fun ids(context: Context): IntArray =
    AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, LifeWidgetProvider::class.java))

  private fun isKeyguard(options: Bundle): Boolean =
    options.getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY) and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD != 0

  /** The size the host gives, in dp: portrait width and height, or the lock-screen box until it says. */
  private fun size(options: Bundle): Pair<Int, Int> {
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    return if (width > 0 && height > 0) width to height else BOX_WIDTH_DP to BOX_HEIGHT_DP
  }

  /** Draws these widgets (all of them by default) as things stand now. */
  @Synchronized
  fun refresh(context: Context, ids: IntArray = ids(context)) {
    if (ids.isEmpty()) return
    val manager = AppWidgetManager.getInstance(context)
    val files = WidgetFiles(context)
    val snapshot = files.snapshot()
    val queued = files.queued()
    val timer = TimerCore.state(context)
    val nowMs = System.currentTimeMillis()
    val zone = ZoneId.systemDefault()
    val renderer = WidgetRenderer(context)
    for (id in ids) {
      val options = manager.getAppWidgetOptions(id)
      // Only the keyguard's frame is built from lock-screen labels; anything else could hold a real name.
      val frame: WidgetFrame<Label> = if (isKeyguard(options)) {
        WidgetViews.build(snapshot, timer, queued, nowMs, zone, KeyguardLabels)
      } else {
        WidgetViews.build(snapshot, timer, queued, nowMs, zone, HomeScreenLabels)
      }
      val (width, height) = size(options)
      manager.updateAppWidget(id, renderer.render(frame, width, height))
    }
  }
}
