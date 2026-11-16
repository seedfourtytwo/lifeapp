package expo.modules.lifewidget

import android.content.Context

/** A timer the widget is running: when it started and the local day it belongs to. */
data class RunningTimer(val startedAtMs: Long, val date: String)

/**
 * Timers started from the widget, kept in the ":widget" process's own
 * preferences. They are separate from the app's in-app timers on purpose: the
 * app holds its running timers in memory and rewrites its whole persisted
 * record on every change, so a session written there from another process
 * would be silently overwritten. Stopping a widget timer writes the same
 * `timer_session` event the app writes, which is where the two meet.
 *
 * Call on WidgetActions.executor or a binder thread only.
 */
internal object WidgetTimers {
  private const val PREFS = "life_widget_timers"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun all(context: Context): Map<String, RunningTimer> {
    val result = HashMap<String, RunningTimer>()
    for ((id, raw) in prefs(context).all) {
      parse(raw as? String)?.let { result[id] = it }
    }
    return result
  }

  fun start(context: Context, habitId: String, timer: RunningTimer) {
    prefs(context).edit().putString(habitId, "${timer.startedAtMs}|${timer.date}").commit()
  }

  fun get(context: Context, habitId: String): RunningTimer? = parse(prefs(context).getString(habitId, null))

  fun clear(context: Context, habitId: String) {
    prefs(context).edit().remove(habitId).commit()
  }

  private fun parse(raw: String?): RunningTimer? {
    val parts = raw?.split('|') ?: return null
    if (parts.size != 2) return null
    val startedAt = parts[0].toLongOrNull() ?: return null
    return RunningTimer(startedAt, parts[1])
  }
}
