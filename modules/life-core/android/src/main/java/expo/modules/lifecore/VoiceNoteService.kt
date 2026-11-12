package expo.modules.lifecore

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

/**
 * Plays the voice note once, foreground with type `mediaPlayback` so it
 * plays on with the phone locked. It never takes the audio focus: a habit
 * timer's track keeps the focus and its session (the timer service ducks
 * its own volume while the note plays), and nobody else's audio is paused.
 */
class VoiceNoteService : Service() {
  private var player: ExoPlayer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action != ACTION_PLAY) {
      stopNow()
      return START_NOT_STICKY
    }
    // Started with startForegroundService: in the foreground within seconds, whatever follows.
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    val file = VoiceNote.file(this)
    if (!file.exists()) {
      stopNow()
      return START_NOT_STICKY
    }
    player?.release()
    player = ExoPlayer.Builder(this).build().apply {
      setAudioAttributes(
        AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(),
        false,
      )
      addListener(object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
          if (state == Player.STATE_ENDED) stopNow()
        }

        override fun onPlayerError(error: PlaybackException) {
          stopNow()
        }
      })
      setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
      prepare()
      play()
    }
    VoiceNote.setPlaying(true)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    player?.release()
    player = null
    VoiceNote.setPlaying(false)
    super.onDestroy()
  }

  private fun stopNow() {
    player?.release()
    player = null
    VoiceNote.setPlaying(false)
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun notification(): Notification {
    val words = AppLanguage.localized(this)
    ensureChannel(this, words)
    val stop = PendingIntent.getService(
      this,
      0,
      Intent(this, VoiceNoteService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    // Nothing in it is private: the same on a locked phone.
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.life_core_timer)
      .setContentTitle(words.getString(R.string.life_core_note_playing))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setSilent(true)
      .setOngoing(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .addAction(0, words.getString(R.string.life_core_note_stop), stop)
      .build()
  }

  companion object {
    const val ACTION_PLAY = "expo.modules.lifecore.note.PLAY"
    const val ACTION_STOP = "expo.modules.lifecore.note.STOP"
    private const val CHANNEL_ID = "life_core_note"
    private const val NOTIFICATION_ID = 6_003

    private fun ensureChannel(context: Context, words: Context) {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, words.getString(R.string.life_core_note_channel), NotificationManager.IMPORTANCE_LOW).apply {
          setSound(null, null)
          enableVibration(false)
          setShowBadge(false)
        },
      )
    }
  }
}
