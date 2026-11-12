package expo.modules.lifecore

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.lifecore.widget.QueueMemory
import expo.modules.lifecore.widget.QueuedAction
import java.io.File
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

/**
 * The one running habit timer of this process: every transition, from the
 * app, the notification or the service, goes through here, is written to
 * `timer.json` at once and told to the listeners (the service, the module).
 * A finished session is appended to the pending-actions queue for
 * JavaScript to log; native never touches SQLite.
 */
object TimerCore {
  private var loaded = false
  private var session: TimerSession? = null
  private val listeners = CopyOnWriteArraySet<(TimerSession?) -> Unit>()

  private fun widgetDir(context: Context) = File(context.filesDir, "widget")

  private fun timerFile(context: Context) = TimerFile(File(widgetDir(context), "timer.json"))

  private fun queue(context: Context) =
    PendingActionsQueue(OsQueueFiles(File(widgetDir(context), "pending-actions.jsonl")))

  private fun now() = System.currentTimeMillis()

  fun addListener(listener: (TimerSession?) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (TimerSession?) -> Unit) {
    listeners.remove(listener)
  }

  /**
   * The first read in a process: a session saved as running was being run by
   * a process that is gone (the service lives in this one), so it stands
   * paused at its last heartbeat. The service is not restarted with sound.
   */
  private fun load(context: Context): TimerSession? {
    if (!loaded) {
      loaded = true
      val saved = timerFile(context).read()
      session = saved?.pauseAtLastHeartbeat()
      session?.takeIf { it !== saved }?.let(timerFile(context)::write)
    }
    return session
  }

  private fun change(context: Context, next: TimerSession?) {
    if (next === session) return
    session = next
    if (next == null) timerFile(context).delete() else timerFile(context).write(next)
    for (listener in listeners) listener(next)
  }

  /** Asks the service to bring sound, alarm and notification in line. */
  private fun runService(context: Context) {
    ContextCompat.startForegroundService(context, Intent(context, TimerService::class.java))
  }

  @Synchronized
  fun state(context: Context): TimerSession? = load(context)

  /**
   * Starts a session for this tracker, resumes its paused one, or leaves its
   * running one alone. Another tracker's session is refused: one at a time,
   * and the caller decides how that one ends.
   */
  @Synchronized
  fun start(context: Context, request: TimerStartRequest): TimerSession {
    val current = load(context)
    if (current != null && current.request.trackerId != request.trackerId) {
      throw IllegalStateException("A timer is already running for ${current.request.trackerId}")
    }
    val nowMs = now()
    val next = current?.resume(nowMs) ?: TimerSession.start(request, nowMs, TimerJson.localDay(nowMs), UUID.randomUUID().toString())
    change(context, next)
    runService(context)
    return next
  }

  @Synchronized
  fun pause(context: Context): TimerSession? {
    val next = load(context)?.pause(now())
    change(context, next)
    return next
  }

  @Synchronized
  fun resume(context: Context): TimerSession? {
    val current = load(context) ?: return null
    val next = current.resume(now())
    change(context, next)
    runService(context)
    return next
  }

  /** The service is alive and the session runs: saved, but nobody needs telling. */
  @Synchronized
  fun heartbeat(context: Context) {
    val current = load(context) ?: return
    val next = current.heartbeat(now())
    if (next === current) return
    session = next
    timerFile(context).write(next)
  }

  /** True when this call is the one that reached the goal. */
  @Synchronized
  fun reachGoal(context: Context): Boolean {
    val current = load(context) ?: return false
    val next = current.reachGoal(now())
    change(context, next)
    return next !== current
  }

  /** Ends the session, queues its record for JavaScript and hands it back; null with none. */
  @Synchronized
  fun finish(context: Context, markComplete: Boolean, trackCompleted: Boolean): TimerSessionRecord? {
    val current = load(context) ?: return null
    val nowMs = now()
    val record = current.finish(nowMs, TimerJson.localDay(nowMs), markComplete, trackCompleted)
    // Queued before the session goes: a crash in between leaves the session
    // to finish again, and its line carries the same id, so it is logged once.
    queue(context).append(TimerJson.encodeRecord(record))
    QueueMemory.remember(QueuedAction.TimerSessionDone.of(record))
    change(context, null)
    return record
  }

  @Synchronized
  fun discard(context: Context) {
    load(context)
    change(context, null)
  }
}
