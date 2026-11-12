package expo.modules.lifecore.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.lifecore.TimerCore
import expo.modules.lifecore.TimerSession
import expo.modules.lifecore.widget.Today
import expo.modules.lifecore.widget.WidgetFiles
import expo.modules.lifecore.widget.WidgetToday
import java.io.File
import java.io.IOException
import java.time.ZoneId

/**
 * The habit reminders: one exact alarm at the next moment of the plan
 * JavaScript wrote, re-armed after it goes off, when the plan changes, and
 * on boot, a clock or a zone change. At the moment the reminder goes out
 * only if the habit is still to do, as the widget sees today.
 */
object Reminders {
  private const val ACTION_FIRE = "expo.modules.lifecore.reminders.FIRE"
  private const val EXTRA_ARMED_FOR = "armedFor"

  private fun planFile(context: Context) = File(context.filesDir, "widget/reminders.json")

  /** The plan on disk, or null when there is none or it does not read. */
  fun plan(context: Context): ReminderPlan? = try {
    planFile(context).takeIf(File::exists)?.readText()?.let(ReminderPlanJson::parse)
  } catch (_: IOException) {
    null
  }

  private fun fireIntent(context: Context, armedForMs: Long?): PendingIntent = PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, ReminderReceiver::class.java).setAction(ACTION_FIRE).apply {
      armedForMs?.let { putExtra(EXTRA_ARMED_FOR, it) }
    },
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  /** Arms the one alarm for the next moment after now, or cancels it when nothing is to come. */
  fun arm(context: Context, plan: ReminderPlan? = plan(context)) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val atMs = plan?.let { ReminderRules.next(it, System.currentTimeMillis(), ZoneId.systemDefault()) }
    if (atMs == null) {
      alarms.cancel(fireIntent(context, null))
      return
    }
    val intent = fireIntent(context, atMs)
    // A reminder wakes the phone; USE_EXACT_ALARM grants the exact form from Android 13.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, intent)
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, intent)
    }
  }

  /**
   * Takes away the reminders on screen whose habit is settled now, as the
   * widget's view of today says: after every snapshot write and widget redraw,
   * so a tick or a finished timer in the app clears them as the widget's do.
   */
  fun clearSettled(context: Context, today: Today?, timer: TimerSession?) {
    val posted = ReminderNotification.posted(context)
    if (posted.isEmpty()) return
    for (id in ReminderRules.toClear(posted, plan(context), today, timer)) ReminderNotification.cancel(context, id)
  }

  internal fun isFire(intent: Intent) = intent.action == ACTION_FIRE

  /** The alarm went off: post what is still to do, then arm the next. */
  internal fun fire(context: Context, intent: Intent) {
    val nowMs = System.currentTimeMillis()
    val armedForMs = intent.getLongExtra(EXTRA_ARMED_FOR, nowMs)
    val plan = plan(context)
    if (plan != null) {
      val zone = ZoneId.systemDefault()
      val files = WidgetFiles(context)
      val today = files.snapshot()?.let { WidgetToday.of(it, files.queued(), nowMs, zone) }
      for (post in ReminderRules.toPost(plan, armedForMs, nowMs, zone, today, TimerCore.state(context))) {
        ReminderNotification.post(context, plan.language, post)
      }
    }
    arm(context, plan)
  }
}

/** The reminder alarm, in the app's process. Not exported: only this app's own PendingIntent reaches it. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (Reminders.isFire(intent)) Reminders.fire(context, intent)
  }
}
