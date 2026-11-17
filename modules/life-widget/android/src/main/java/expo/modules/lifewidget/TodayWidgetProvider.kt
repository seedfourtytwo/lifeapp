package expo.modules.lifewidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal object WidgetActions {
  const val ACTION_REFRESH = "expo.modules.lifewidget.action.REFRESH"
  const val ACTION_TAP = "expo.modules.lifewidget.action.TAP"
  const val ACTION_ALARM = "expo.modules.lifewidget.action.ALARM"

  const val EXTRA_TAP_KIND = "expo.modules.lifewidget.extra.TAP_KIND"
  const val EXTRA_ID = "expo.modules.lifewidget.extra.ID"
  const val EXTRA_DATE = "expo.modules.lifewidget.extra.DATE"
  const val EXTRA_WANT_DONE = "expo.modules.lifewidget.extra.WANT_DONE"
  const val EXTRA_INCREMENT = "expo.modules.lifewidget.extra.INCREMENT"

  const val TAP_HABIT = "habit"
  const val TAP_COUNTER = "counter"
  const val TAP_TODO = "todo"
  const val TAP_TIMER_TOGGLE = "timer_toggle"
  const val TAP_TIMER_STOP = "timer_stop"
  /** From the player, never from a row: the audio was interrupted / the track finished. */
  const val TAP_TIMER_PAUSE = "timer_pause"
  const val TAP_TIMER_ENDED = "timer_ended"
  /** A row with nothing to do on tap. Stated explicitly because row views are recycled. */
  const val TAP_NONE = "none"

  private const val REQUEST_TAP_TEMPLATE = 1
  private const val REQUEST_ALARM = 2
  private const val REQUEST_OPEN_APP = 3
  private const val REQUEST_NOW_TOGGLE = 4
  private const val REQUEST_NOW_STOP = 5

  /** One background thread per :widget process: every DB read and write runs here in order. */
  val executor: ExecutorService = Executors.newSingleThreadExecutor()

  /**
   * Opens the app. Only the header's open button and the "no data yet" message
   * use it: every row acts inside the widget, because from the lock-screen page
   * a launch needs the unlock first.
   */
  fun openAppPendingIntent(context: Context): PendingIntent? {
    // The package's own launch intent, so `.dev` and release both work.
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    return PendingIntent.getActivity(
      context,
      REQUEST_OPEN_APP,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** A broadcast to WidgetActionReceiver that is not a row tap: notification buttons and the player. */
  fun timerIntent(context: Context, kind: String, habitId: String): Intent =
    Intent(context, WidgetActionReceiver::class.java)
      .setAction(ACTION_TAP)
      .putExtra(EXTRA_TAP_KIND, kind)
      .putExtra(EXTRA_ID, habitId)

  /** A button of the pinned "now" item, which is outside the list and so cannot use a fill-in. */
  fun nowIntent(context: Context, stop: Boolean, habitId: String): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      if (stop) REQUEST_NOW_STOP else REQUEST_NOW_TOGGLE,
      timerIntent(context, if (stop) TAP_TIMER_STOP else TAP_TIMER_TOGGLE, habitId),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /** The list's click template. Fill-in intents add the extras, so it must be mutable on API 31+. */
  fun tapTemplate(context: Context): PendingIntent {
    val intent = Intent(context, WidgetActionReceiver::class.java)
      .setAction(ACTION_TAP)
      .addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
    return PendingIntent.getBroadcast(context, REQUEST_TAP_TEMPLATE, intent, flags)
  }

  private fun alarmPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, WidgetActionReceiver::class.java).setAction(ACTION_ALARM)
    return PendingIntent.getBroadcast(
      context,
      REQUEST_ALARM,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun widgetIds(context: Context): IntArray =
    AppWidgetManager.getInstance(context)
      .getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))

  /** Main-process safe: only sends a broadcast to the :widget receiver, never touches the DB. */
  fun requestUpdate(context: Context) {
    if (widgetIds(context).isEmpty()) return
    val intent = Intent(context, WidgetActionReceiver::class.java).setAction(ACTION_REFRESH)
    context.sendBroadcast(intent)
  }

  /** Runs `work` on the executor and keeps the broadcast alive until it finishes. */
  fun runAsync(receiver: BroadcastReceiver, context: Context, work: () -> Unit) {
    val pending = receiver.goAsync()
    val appContext = context.applicationContext
    executor.execute {
      try {
        WidgetDb.dropOrphanedSoundTimers(appContext, WidgetPlayerService.habitId)
        work()
        WidgetUpdater.updateAll(appContext)
      } catch (e: Exception) {
        Log.w("LifeWidget", "Widget work failed", e)
      } finally {
        pending.finish()
      }
    }
  }

  /**
   * Inexact alarm (no exact-alarm permission): just after the next local
   * midnight, or earlier at the next habit visibility-window boundary. Nothing
   * shorter is worth asking for: the system stretches an inexact window to ten
   * minutes, which is why a running timer's live time is a Chronometer.
   */
  fun scheduleNextRefresh(context: Context, snapshot: WidgetSnapshot) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now()
    var triggerAt = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli() + 5_000L
    if (snapshot is WidgetSnapshot.Ready && snapshot.today == today) {
      val boundary = snapshot.nextBoundaryMinute
      if (boundary != null) {
        val at = today.atTime(boundary / 60, boundary % 60).atZone(zone).toInstant().toEpochMilli()
        if (at > System.currentTimeMillis() && at < triggerAt) triggerAt = at
      }
    }
    alarmManager.setWindow(AlarmManager.RTC, triggerAt, 10 * 60 * 1000L, alarmPendingIntent(context))
  }

  fun cancelRefresh(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    alarmManager.cancel(alarmPendingIntent(context))
  }
}

internal object WidgetUpdater {
  /** Call on WidgetActions.executor only (reads the DB). */
  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
    if (ids.isEmpty()) {
      WidgetActions.cancelRefresh(context)
      return
    }
    val snapshot = WidgetDb.loadSnapshot(context)
    for (id in ids) {
      manager.updateAppWidget(id, buildViews(context, id, snapshot))
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      // Below API 31 the list comes from TodayWidgetService and has to be told to reload.
      @Suppress("DEPRECATION")
      manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
    }
    WidgetActions.scheduleNextRefresh(context, snapshot)
  }

  private fun buildViews(context: Context, appWidgetId: Int, snapshot: WidgetSnapshot): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.life_widget_today)

    val dateLabel = DateTimeFormatter.ofPattern("EEE d", Locale.getDefault()).format(LocalDate.now())
    views.setTextViewText(R.id.widget_date, dateLabel)

    if (snapshot is WidgetSnapshot.Ready && snapshot.model.due > 0) {
      views.setTextViewText(R.id.widget_progress, "${snapshot.model.done}/${snapshot.model.due}")
      views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
      views.setProgressBar(R.id.widget_progress_bar, snapshot.model.due, snapshot.model.done, false)
      views.setViewVisibility(R.id.widget_progress_bar, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.widget_progress, View.GONE)
      views.setViewVisibility(R.id.widget_progress_bar, View.GONE)
    }

    views.setTextViewText(
      R.id.widget_empty,
      context.getString(
        if (snapshot is WidgetSnapshot.NoDatabase) R.string.life_widget_empty_no_db else R.string.life_widget_empty_all_done,
      ),
    )

    val nowRow = bindNow(context, views, snapshot)
    bindList(context, views, appWidgetId, snapshot, nowRow)
    views.setEmptyView(R.id.widget_list, R.id.widget_empty)
    views.setPendingIntentTemplate(R.id.widget_list, WidgetActions.tapTemplate(context))

    val open = WidgetActions.openAppPendingIntent(context)
    if (open != null) {
      views.setOnClickPendingIntent(R.id.widget_open, open)
      if (snapshot is WidgetSnapshot.NoDatabase) views.setOnClickPendingIntent(R.id.widget_empty, open)
    }
    return views
  }

  /**
   * From API 31 the rows are built here and sent inside the widget's own
   * RemoteViews. The older adapter service is filled in by the system on its
   * own schedule, after the header — on recent Android versions late enough
   * that a second update could put an old header back over a new list.
   */
  private fun bindList(
    context: Context,
    views: RemoteViews,
    appWidgetId: Int,
    snapshot: WidgetSnapshot,
    nowRow: WidgetRow.Habit?,
  ) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val all = if (snapshot is WidgetSnapshot.Ready) snapshot.model.rows else emptyList()
      // The pinned item is not repeated in the list, nor is a NOW heading left over an empty section.
      val withoutNow = all.filter { it !== nowRow }
      val rows = withoutNow.filterIndexed { index, row ->
        !(row is WidgetRow.Label && row.section == Section.NOW && withoutNow.getOrNull(index + 1) !is WidgetRow.Habit)
      }
      val builder = WidgetRows(context, (snapshot as? WidgetSnapshot.Ready)?.today?.toString() ?: "")
      val items = RemoteViews.RemoteCollectionItems.Builder()
        .setHasStableIds(true)
        .setViewTypeCount(builder.viewTypeCount)
      for (row in rows) items.addItem(builder.itemId(row), builder.views(row))
      views.setRemoteAdapter(R.id.widget_list, items.build())
      return
    }
    val adapter = Intent(context, TodayWidgetService::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    // A distinct data URI per widget id, so the system does not reuse one factory for all.
    adapter.data = Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME))
    @Suppress("DEPRECATION")
    views.setRemoteAdapter(R.id.widget_list, adapter)
  }

  /**
   * Draws the habit the widget is timing as the pinned item, and returns its
   * row so the list can leave it out. Below API 31 the list comes from the
   * adapter service and keeps the row; the pinned item is then an extra.
   */
  private fun bindNow(context: Context, views: RemoteViews, snapshot: WidgetSnapshot): WidgetRow.Habit? {
    val row = (snapshot as? WidgetSnapshot.Ready)?.model?.rows
      ?.firstOrNull { it is WidgetRow.Habit && it.runningSinceMs != null && !it.inApp } as? WidgetRow.Habit
    val since = row?.runningSinceMs
    if (row == null || since == null) {
      views.setViewVisibility(R.id.widget_now, View.GONE)
      return null
    }
    views.setViewVisibility(R.id.widget_now, View.VISIBLE)
    views.setTextViewText(R.id.widget_now_name, row.name)

    // Today's time so far: what is already logged plus this session, over the goal.
    val paused = row.pausedElapsedMs
    val sessionMs = paused ?: (System.currentTimeMillis() - since).coerceAtLeast(0)
    val shownMs = row.loggedSeconds * 1000L + sessionMs
    val target = row.targetSeconds
    val prefix = if (paused != null) context.getString(R.string.life_widget_paused) + " · " else ""
    // Paused, the goal is dropped: with two buttons beside it the line has no room for both.
    val suffix = if (target != null && paused == null) " / ${TodayRules.formatElapsed(target)}" else ""
    // The format goes in before the base, because only setBase redraws the text.
    // "%s" is where the time goes, so a literal percent sign has to be doubled.
    views.setString(R.id.widget_now_clock, "setFormat", prefix.replace("%", "%%") + "%s" + suffix.replace("%", "%%"))
    views.setLong(R.id.widget_now_clock, "setBase", SystemClock.elapsedRealtime() - shownMs)
    views.setBoolean(R.id.widget_now_clock, "setStarted", paused == null)
    if (target != null && target > 0) {
      views.setProgressBar(R.id.widget_now_progress, target, (shownMs / 1000).coerceAtMost(target.toLong()).toInt(), false)
      views.setViewVisibility(R.id.widget_now_progress, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.widget_now_progress, View.GONE)
    }

    val stopLabel = context.getString(R.string.life_widget_stop_timer_a11y, row.name)
    views.setImageViewResource(R.id.widget_now_stop, R.drawable.life_widget_ic_stop)
    views.setContentDescription(R.id.widget_now_stop, stopLabel)
    views.setOnClickPendingIntent(R.id.widget_now_stop, WidgetActions.nowIntent(context, stop = true, habitId = row.id))
    if (row.hasAudio) {
      val label = context.getString(
        if (paused != null) R.string.life_widget_resume_timer_a11y else R.string.life_widget_pause_timer_a11y,
        row.name,
      )
      views.setViewVisibility(R.id.widget_now_toggle, View.VISIBLE)
      views.setImageViewResource(
        R.id.widget_now_toggle,
        if (paused != null) R.drawable.life_widget_ic_play else R.drawable.life_widget_ic_pause,
      )
      views.setContentDescription(R.id.widget_now_toggle, label)
      views.setOnClickPendingIntent(R.id.widget_now_toggle, WidgetActions.nowIntent(context, stop = false, habitId = row.id))
    } else {
      views.setViewVisibility(R.id.widget_now_toggle, View.GONE)
    }
    return row
  }
}

/**
 * The home-screen provider. Exported (the system delivers APPWIDGET_* here) and,
 * like every component of this module that reaches the DB, in ":widget".
 */
class TodayWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      -> WidgetActions.runAsync(this, context) {}
      else -> super.onReceive(context, intent)
    }
  }

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    WidgetActions.runAsync(this, context) {}
  }

  override fun onDisabled(context: Context) {
    WidgetActions.cancelRefresh(context)
  }
}

/**
 * Taps, app refresh requests and the rollover alarm. Not exported: only this
 * app (its PendingIntents and its main process) can reach it.
 */
class WidgetActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      WidgetActions.ACTION_REFRESH, WidgetActions.ACTION_ALARM -> WidgetActions.runAsync(this, context) {}
      WidgetActions.ACTION_TAP -> handleTap(context, intent)
    }
  }

  private fun timerAction(context: Context, habitId: String, action: TimerAction) {
    val appContext = context.applicationContext
    WidgetActions.runAsync(this, context) {
      WidgetDb.timerAction(appContext, habitId, action)?.let { WidgetPlayerService.apply(appContext, it) }
    }
  }

  private fun handleTap(context: Context, intent: Intent) {
    val kind = intent.getStringExtra(WidgetActions.EXTRA_TAP_KIND) ?: return
    if (kind == WidgetActions.TAP_NONE) return
    val id = intent.getStringExtra(WidgetActions.EXTRA_ID) ?: return
    val date = intent.getStringExtra(WidgetActions.EXTRA_DATE) ?: ""
    val appContext = context.applicationContext
    when (kind) {
      WidgetActions.TAP_HABIT -> {
        val wantDone = intent.getBooleanExtra(WidgetActions.EXTRA_WANT_DONE, true)
        WidgetActions.runAsync(this, context) { WidgetDb.applyHabitIntent(appContext, id, date, wantDone) }
      }
      WidgetActions.TAP_COUNTER -> {
        val increment = intent.getDoubleExtra(WidgetActions.EXTRA_INCREMENT, 0.0)
        WidgetActions.runAsync(this, context) { WidgetDb.incrementCounter(appContext, id, date, increment) }
      }
      WidgetActions.TAP_TIMER_TOGGLE -> timerAction(context, id, TimerAction.TOGGLE)
      WidgetActions.TAP_TIMER_STOP -> timerAction(context, id, TimerAction.STOP)
      WidgetActions.TAP_TIMER_PAUSE -> timerAction(context, id, TimerAction.PAUSE)
      WidgetActions.TAP_TIMER_ENDED -> timerAction(context, id, TimerAction.TRACK_ENDED)
      WidgetActions.TAP_TODO -> {
        WidgetActions.runAsync(this, context) { WidgetDb.completeTodo(appContext, id) }
      }
    }
  }
}
