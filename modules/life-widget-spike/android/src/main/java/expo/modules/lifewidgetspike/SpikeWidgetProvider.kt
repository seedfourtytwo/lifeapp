package expo.modules.lifewidgetspike

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.SizeF
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// THROWAWAY spike widget. See SpikeLog for where results go.
class SpikeWidgetProvider : AppWidgetProvider() {

  companion object {
    const val ACTION_COUNT = "life.spike.COUNT"
    const val ACTION_START = "life.spike.START"
    const val ACTION_PAUSE = "life.spike.PAUSE"
    const val ACTION_SERVICE = "life.spike.SERVICE"
    private const val PREFS = "life_spike"

    fun describeHosts(ctx: Context): String {
      val mgr = AppWidgetManager.getInstance(ctx)
      val ids = mgr.getAppWidgetIds(ComponentName(ctx, SpikeWidgetProvider::class.java))
      if (ids.isEmpty()) return "widgets=none"
      return ids.joinToString(" | ") { "id=$it ${describeOptions(mgr.getAppWidgetOptions(it))}" }
    }

    fun describeOptions(o: Bundle?): String {
      if (o == null) return "opts=null"
      val cat = when (val c = o.getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY, -1)) {
        AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN -> "home_screen(1)"
        AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD -> "keyguard(2)"
        AppWidgetProviderInfo.WIDGET_CATEGORY_SEARCHBOX -> "searchbox(4)"
        else -> "other($c)"
      }
      val minW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val minH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
      val maxW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
      val maxH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
      var sizes = ""
      if (Build.VERSION.SDK_INT >= 31) {
        @Suppress("DEPRECATION")
        val list = o.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        sizes = " sizes=${list?.joinToString(",") { "${it.width.toInt()}x${it.height.toInt()}" } ?: "null"}"
      }
      return "cat=$cat min=${minW}x$minH max=${maxW}x$maxH$sizes"
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: "null"
    try {
      SpikeLog.line(context, "onReceive action=$action ${describeHosts(context)}")
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      when (action) {
        ACTION_COUNT -> {
          val n = prefs.getInt("count", 0) + 1
          prefs.edit().putInt("count", n).putLong("lastTap", System.currentTimeMillis()).apply()
          SpikeLog.line(context, "COUNT -> $n")
          refreshAll(context)
        }
        ACTION_START -> {
          if (!prefs.getBoolean("running", false)) {
            val accum = prefs.getLong("accumMs", 0)
            prefs.edit().putBoolean("running", true)
              .putLong("base", SystemClock.elapsedRealtime() - accum).apply()
          }
          SpikeLog.line(context, "START running=true")
          refreshAll(context)
        }
        ACTION_PAUSE -> {
          if (prefs.getBoolean("running", false)) {
            val accum = SystemClock.elapsedRealtime() - prefs.getLong("base", SystemClock.elapsedRealtime())
            prefs.edit().putBoolean("running", false).putLong("accumMs", accum).apply()
          }
          SpikeLog.line(context, "PAUSE accumMs=${prefs.getLong("accumMs", 0)}")
          refreshAll(context)
        }
        ACTION_SERVICE -> {
          try {
            context.startForegroundService(Intent(context, SpikeService::class.java))
            SpikeLog.line(context, "SERVICE startForegroundService returned OK")
          } catch (t: Throwable) {
            SpikeLog.line(context, "SERVICE startForegroundService THREW ${t.javaClass.name}: ${t.message}")
          }
        }
        else -> super.onReceive(context, intent)
      }
    } catch (t: Throwable) {
      SpikeLog.line(context, "onReceive action=$action EXCEPTION ${t.javaClass.name}: ${t.message}")
    }
  }

  override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
    SpikeLog.line(context, "onUpdate ids=${ids.joinToString(",")}")
    ids.forEach { mgr.updateAppWidget(it, build(context, mgr.getAppWidgetOptions(it))) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, mgr: AppWidgetManager, id: Int, opts: Bundle?) {
    SpikeLog.line(context, "onAppWidgetOptionsChanged id=$id ${describeOptions(opts)}")
    mgr.updateAppWidget(id, build(context, opts))
  }

  override fun onEnabled(context: Context) = SpikeLog.line(context, "onEnabled")
  override fun onDisabled(context: Context) = SpikeLog.line(context, "onDisabled")
  override fun onDeleted(context: Context, ids: IntArray) =
    SpikeLog.line(context, "onDeleted ids=${ids.joinToString(",")}")

  private fun refreshAll(ctx: Context) {
    val mgr = AppWidgetManager.getInstance(ctx)
    mgr.getAppWidgetIds(ComponentName(ctx, SpikeWidgetProvider::class.java)).forEach {
      mgr.updateAppWidget(it, build(ctx, mgr.getAppWidgetOptions(it)))
    }
  }

  private fun broadcast(ctx: Context, action: String, req: Int): PendingIntent =
    PendingIntent.getBroadcast(
      ctx, req,
      Intent(ctx, SpikeWidgetProvider::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun build(ctx: Context, opts: Bundle?): RemoteViews {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val v = RemoteViews(ctx.packageName, R.layout.life_spike_widget)
    val last = prefs.getLong("lastTap", 0)
    val lastStr = if (last == 0L) "never" else SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(last))
    v.setTextViewText(R.id.spike_count, "taps: ${prefs.getInt("count", 0)}  last: $lastStr")
    v.setTextViewText(R.id.spike_host, describeOptions(opts))

    val running = prefs.getBoolean("running", false)
    val base = if (running) prefs.getLong("base", SystemClock.elapsedRealtime())
    else SystemClock.elapsedRealtime() - prefs.getLong("accumMs", 0)
    v.setChronometer(R.id.spike_chrono, base, null, running)

    v.setOnClickPendingIntent(R.id.spike_btn_count, broadcast(ctx, ACTION_COUNT, 1))
    v.setOnClickPendingIntent(R.id.spike_btn_start, broadcast(ctx, ACTION_START, 2))
    v.setOnClickPendingIntent(R.id.spike_btn_pause, broadcast(ctx, ACTION_PAUSE, 3))
    v.setOnClickPendingIntent(R.id.spike_btn_service, broadcast(ctx, ACTION_SERVICE, 4))
    v.setOnClickPendingIntent(
      R.id.spike_btn_open,
      PendingIntent.getActivity(
        ctx, 5, Intent(ctx, SpikeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      ),
    )
    return v
  }
}
