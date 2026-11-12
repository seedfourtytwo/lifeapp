package expo.modules.lifecore.widget

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import expo.modules.lifecore.TimerCore
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Every widget button lands here, in the app's process, whether or not the
 * React Native app is running. Not exported: only this app's own
 * PendingIntents reach it. It works synchronously, inside the window a
 * user's tap grants, which is what lets it start the timer's foreground
 * service from a locked phone.
 */
class WidgetActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_TAP) return
    val tap = intent.data?.schemeSpecificPart?.let(TapCodec::decode) ?: return
    val nowMs = System.currentTimeMillis()
    if (!guard.accept(tap, nowMs)) return
    val files = WidgetFiles(context)
    val effect = WidgetTaps { UUID.randomUUID().toString() }
      .decide(tap, files.snapshot(), files.queued(), TimerCore.state(context), nowMs, ZoneId.systemDefault())
    try {
      apply(context, files, effect)
    } catch (error: IllegalStateException) {
      // The timer core refused (another session began meanwhile): the tap does nothing.
      Log.w(TAG, "Widget tap not applied", error)
    }
    // Drawn at once from the files, before JavaScript (if it runs at all) hears of it.
    LifeWidget.refresh(context)
  }

  private fun apply(context: Context, files: WidgetFiles, effect: TapEffect) {
    when (effect) {
      is TapEffect.Queue -> {
        files.append(effect.action)
        WidgetEvents.queued()
      }
      is TapEffect.Start -> TimerCore.start(context, effect.request)
      TapEffect.PauseTimer -> TimerCore.pause(context)
      TapEffect.ResumeTimer -> TimerCore.resume(context)
      TapEffect.FinishTimer -> TimerCore.finish(context, markComplete = true, trackCompleted = false)
      TapEffect.DiscardTimer -> TimerCore.discard(context)
      TapEffect.Ignore -> Unit
    }
  }

  companion object {
    private const val TAG = "LifeWidget"
    private const val ACTION_TAP = "expo.modules.lifecore.widget.TAP"
    private const val SCHEME = "lifecore-widget"
    /** A second press of the same button within this is the same press. */
    private val guard = TapGuard(windowMs = 700)

    /** The button's PendingIntent: immutable, and one of its own for each tap. */
    fun pendingIntent(context: Context, tap: Tap): PendingIntent = PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, WidgetActionReceiver::class.java)
        .setAction(ACTION_TAP)
        .setData(Uri.fromParts(SCHEME, TapCodec.encode(tap), null)),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}

/** Tells a running app that the widget queued a line, so it drains at once. */
object WidgetEvents {
  private val listeners = CopyOnWriteArraySet<() -> Unit>()

  fun addListener(listener: () -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: () -> Unit) {
    listeners.remove(listener)
  }

  fun queued() {
    for (listener in listeners) listener()
  }
}
