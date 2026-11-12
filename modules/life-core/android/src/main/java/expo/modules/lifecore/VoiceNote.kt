package expo.modules.lifecore

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet

/**
 * The voice note JavaScript records into `files/widget/voice-note.m4a`.
 * [VoiceNoteService] plays it, from the app, the urge screen or the
 * widget's ride, locked or not; while it plays, a running habit timer's
 * sound is ducked under it rather than paused, so the session runs on.
 */
object VoiceNote {
  private val listeners = CopyOnWriteArraySet<(Boolean) -> Unit>()

  @Volatile
  var playing: Boolean = false
    private set

  fun file(context: Context) = File(context.filesDir, "widget/voice-note.m4a")

  fun exists(context: Context): Boolean = file(context).exists()

  fun addListener(listener: (Boolean) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (Boolean) -> Unit) {
    listeners.remove(listener)
  }

  /** The service started or stopped playing. */
  internal fun setPlaying(now: Boolean) {
    if (playing == now) return
    playing = now
    for (listener in listeners) listener(now)
  }

  /** False when there is no note. A user's tap may start the service from the background (widget, notification). */
  fun play(context: Context): Boolean {
    if (!exists(context)) return false
    ContextCompat.startForegroundService(context, Intent(context, VoiceNoteService::class.java).setAction(VoiceNoteService.ACTION_PLAY))
    return true
  }

  fun stop(context: Context) {
    if (!playing) return
    context.startService(Intent(context, VoiceNoteService::class.java).setAction(VoiceNoteService.ACTION_STOP))
  }
}
