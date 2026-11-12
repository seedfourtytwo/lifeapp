package expo.modules.lifecore.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.lifecore.TimerCore
import expo.modules.lifecore.reminders.Reminders
import java.time.ZoneId

/**
 * The lock-screen widget (`widgetCategory="home_screen|keyguard"`). It draws
 * from the snapshot, the timer core and the queue lines not yet applied,
 * so a tap shows at once with the app not running.
 */
class LifeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    LifeWidget.refresh(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    LifeWidget.refresh(context)
  }

  override fun onDisabled(context: Context) {
    WidgetAlarm.set(context, null)
  }
}

/**
 * Boot, a clock or time-zone change, a new language, an app update: draw
 * again, as the day may be another, and arm the next reminder (an update or
 * a reboot clears alarms, and a clock change moves the moment).
 */
class WidgetSystemReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in ACTIONS) return
    LifeWidget.refresh(context)
    Reminders.arm(context)
  }

  private companion object {
    val ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
    )
  }
}

/**
 * One alarm at the next moment the clock alone changes the widget: local
 * midnight, a lamp, a ride's end, the next minute or hour of a clock's
 * words. Exact, and allowed while idle, but not a wakeup: a screen that is
 * off shows nothing, and the alarm fires as soon as the phone wakes.
 */
object WidgetAlarm {
  private const val ACTION_REDRAW = "expo.modules.lifecore.widget.REDRAW"

  private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, WidgetActionReceiver::class.java).setAction(ACTION_REDRAW),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  fun isRedraw(intent: Intent): Boolean = intent.action == ACTION_REDRAW

  fun set(context: Context, atMs: Long?) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val intent = pendingIntent(context)
    when {
      atMs == null -> alarms.cancel(intent)
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms() ->
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC, atMs, intent)
      else -> alarms.setAndAllowWhileIdle(AlarmManager.RTC, atMs, intent)
    }
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

  private val main = Handler(Looper.getMainLooper())

  /** Draws every widget soon, on the main thread; for callers inside the timer core's lock. */
  fun requestRefresh(context: Context) {
    val app = context.applicationContext
    main.post { refresh(app) }
  }

  /** Draws every widget as things stand now, and sets the alarm for the next change. On the main thread. */
  fun refresh(context: Context) {
    val ids = ids(context)
    if (ids.isEmpty()) {
      WidgetAlarm.set(context, null)
      return
    }
    val manager = AppWidgetManager.getInstance(context)
    val files = WidgetFiles(context)
    val snapshot = files.snapshot()
    val queued = files.queued()
    val timer = TimerCore.state(context)
    val nowMs = System.currentTimeMillis()
    val zone = ZoneId.systemDefault()
    val renderer = WidgetRenderer(context)
    var redrawAtMs: Long? = null
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
      redrawAtMs = listOfNotNull(redrawAtMs, frame.redrawAtMs).minOrNull()
    }
    WidgetAlarm.set(context, redrawAtMs)
  }
}
