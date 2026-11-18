package expo.modules.lifewidget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.AssetFileDescriptor
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import java.io.IOException
import java.util.Locale

/**
 * Plays a habit's timer sound for the widget, so a meditation can be started,
 * paused and finished from the lock-screen page without opening the app.
 *
 * It only makes sound. The timer itself (start, pauses, the logged session)
 * is decided in TodayRules.applyTimerAction and stored by WidgetDb; this
 * service is told what to do through [apply], and reports back — the track
 * ended, the audio was taken away — by broadcasting to WidgetActionReceiver.
 * Declared in ":widget" so those two share one process.
 */
class WidgetPlayerService : Service() {
  private var player: MediaPlayer? = null
  private var trackId: String? = null
  private var playingHabitId: String? = null
  private var habitName: String = ""
  private var focusRequest: AudioFocusRequest? = null

  /** Headphones unplugged: pause rather than play out loud. */
  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = report(WidgetActions.TAP_TIMER_PAUSE)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val id = intent?.getStringExtra(EXTRA_HABIT_ID)
    val track = intent?.getStringExtra(EXTRA_TRACK_ID)
    if (id == null || track == null) {
      // Restarted without its command: nothing to play.
      stopPlayback(startId)
      return START_NOT_STICKY
    }
    // `habitId` is set before the service is asked to start and cleared by a
    // Stop, so it is ahead of this command. If it no longer names this habit,
    // a Stop (or another habit's Play) overtook us while the system was still
    // creating the service, and playing now would leave a sound no timer owns.
    if (habitId != id) {
      Log.w(TAG, "Stale play command for $id")
      if (habitId == null) stopPlayback(startId)
      return START_NOT_STICKY
    }
    val sameHabit = playingHabitId == id
    playingHabitId = id
    habitName = intent.getStringExtra(EXTRA_HABIT_NAME) ?: ""
    // Within the few seconds the system allows after startForegroundService.
    startForeground(NOTIFICATION_ID, buildNotification(playing = true))
    play(track, intent.getBooleanExtra(EXTRA_LOOP, true), intent.getLongExtra(EXTRA_POSITION_MS, 0), sameHabit)
    return START_NOT_STICKY
  }

  /**
   * `sameHabit` is false when a different habit took the sound over. Two habits
   * can share a track, and then the loaded player is at the other habit's
   * position with the other habit's looping: start this one from its own place.
   */
  private fun play(track: String, loop: Boolean, positionMs: Long, sameHabit: Boolean) {
    val existing = player
    if (existing != null && trackId == track && sameHabit) {
      // Resuming what was paused here: the player already sits at the right place.
      requestFocus()
      existing.start()
      return
    }
    releasePlayer()
    val source = openTrack(track)
    if (source == null) {
      Log.w(TAG, "No bundled sound for $track")
      report(WidgetActions.TAP_TIMER_STOP)
      return
    }
    // Held outside the try so a failure part-way through still releases the
    // native player — and its wake lock, once setWakeMode has run.
    var created: MediaPlayer? = null
    try {
      val mp = MediaPlayer()
      created = mp
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
      source.use { mp.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
      mp.isLooping = loop
      mp.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
      mp.setOnCompletionListener { report(WidgetActions.TAP_TIMER_ENDED) }
      mp.setOnErrorListener { _, what, extra ->
        Log.w(TAG, "Playback error $what/$extra")
        report(WidgetActions.TAP_TIMER_STOP)
        true
      }
      mp.prepare()
      val duration = mp.duration
      if (positionMs > 0 && duration > 0) {
        // A process that was restarted mid-session picks the sound up where the timer says it is.
        mp.seekTo((if (loop) positionMs % duration else positionMs.coerceAtMost(duration.toLong())).toInt())
      }
      requestFocus()
      mp.start()
      player = mp
      trackId = track
    } catch (e: IOException) {
      failedToPlay(track, e, created)
    } catch (e: RuntimeException) {
      // setDataSource alone can throw IllegalArgumentException, SecurityException
      // or IllegalStateException. Uncaught, any of them takes the :widget process
      // down and the running timer is lost with it.
      failedToPlay(track, e, created)
    }
  }

  private fun failedToPlay(track: String, cause: Exception, created: MediaPlayer?) {
    Log.w(TAG, "Could not play $track", cause)
    created?.release()
    report(WidgetActions.TAP_TIMER_STOP)
  }

  /**
   * Release builds carry the app's sounds as raw resources (Metro names
   * assets/sounds/x.mp3 "assets_sounds_x"); debug builds load them from Metro
   * instead, so this module packs its own copy as assets for debug only.
   */
  private fun openTrack(track: String): AssetFileDescriptor? {
    val resId = resources.getIdentifier("assets_sounds_${track.lowercase(Locale.ROOT)}", "raw", packageName)
    if (resId != 0) return resources.openRawResourceFd(resId)
    return try {
      assets.openFd("$track.mp3")
    } catch (e: IOException) {
      null
    }
  }

  private fun pausePlayback() {
    val current = player ?: return
    if (current.isPlaying) current.pause()
    getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, buildNotification(playing = false))
  }

  /**
   * `startId` is passed when the stop comes from a command being processed, so
   * a newer start already queued behind it keeps the service alive; `stopSelf()`
   * with no id would drop it.
   */
  private fun stopPlayback(startId: Int? = null) {
    releasePlayer()
    stopForeground(STOP_FOREGROUND_REMOVE)
    if (startId != null) stopSelf(startId) else stopSelf()
  }

  private fun releasePlayer() {
    player?.release()
    player = null
    trackId = null
    val audio = getSystemService(AudioManager::class.java)
    focusRequest?.let { audio?.abandonAudioFocusRequest(it) }
    focusRequest = null
  }

  private fun requestFocus() {
    val audio = getSystemService(AudioManager::class.java) ?: return
    val request = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
      .setOnAudioFocusChangeListener { change ->
        // A call or another player took the audio: pause the timer with it.
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
          report(WidgetActions.TAP_TIMER_PAUSE)
        }
      }
      .build()
    focusRequest = request
    audio.requestAudioFocus(request)
  }

  /** Tells the timer what happened; the receiver decides and calls back through [apply]. */
  private fun report(kind: String) {
    val id = playingHabitId ?: return
    sendBroadcast(WidgetActions.timerIntent(this, kind, id))
  }

  private fun buildNotification(playing: Boolean): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (manager?.getNotificationChannel(CHANNEL_ID) == null) {
      manager?.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, getString(R.string.life_widget_player_channel), NotificationManager.IMPORTANCE_LOW),
      )
    }
    val id = playingHabitId ?: ""
    fun action(kind: String, requestCode: Int, label: Int): Notification.Action =
      Notification.Action.Builder(
        null,
        getString(label),
        PendingIntent.getBroadcast(
          this,
          requestCode,
          WidgetActions.timerIntent(this, kind, id),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        ),
      ).build()
    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.life_widget_ic_player)
      .setContentTitle(habitName)
      .setContentText(getString(if (playing) R.string.life_widget_player_playing else R.string.life_widget_player_paused))
      .setOngoing(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .addAction(
        action(
          WidgetActions.TAP_TIMER_TOGGLE,
          REQUEST_TOGGLE,
          if (playing) R.string.life_widget_player_pause else R.string.life_widget_player_resume,
        ),
      )
      .addAction(action(WidgetActions.TAP_TIMER_STOP, REQUEST_STOP, R.string.life_widget_player_stop))
      .build()
  }

  override fun onDestroy() {
    unregisterReceiver(noisyReceiver)
    releasePlayer()
    instance = null
    if (habitId == playingHabitId) habitId = null
    super.onDestroy()
  }

  companion object {
    private const val TAG = "LifeWidget"
    private const val CHANNEL_ID = "life_widget_player"
    private const val NOTIFICATION_ID = 4201
    private const val REQUEST_TOGGLE = 10
    private const val REQUEST_STOP = 11
    private const val EXTRA_HABIT_ID = "expo.modules.lifewidget.player.HABIT_ID"
    private const val EXTRA_HABIT_NAME = "expo.modules.lifewidget.player.HABIT_NAME"
    private const val EXTRA_TRACK_ID = "expo.modules.lifewidget.player.TRACK_ID"
    private const val EXTRA_LOOP = "expo.modules.lifewidget.player.LOOP"
    private const val EXTRA_POSITION_MS = "expo.modules.lifewidget.player.POSITION_MS"

    private val mainHandler = Handler(Looper.getMainLooper())
    private var instance: WidgetPlayerService? = null

    /**
     * The habit whose sound this process is playing or holding paused, set the
     * moment a Play is issued. Null after a process restart, which is how
     * WidgetDb.dropOrphanedSoundTimers tells a timer has lost its sound.
     */
    @Volatile
    var habitId: String? = null
      private set

    /** Carries out the player's side of a timer action. Safe from any thread. */
    fun apply(context: Context, request: WidgetDb.PlayerRequest) {
      when (val command = request.command) {
        is PlayerCommand.None -> Unit
        is PlayerCommand.Play -> {
          habitId = request.habitId
          val intent = Intent(context, WidgetPlayerService::class.java)
            .putExtra(EXTRA_HABIT_ID, request.habitId)
            .putExtra(EXTRA_HABIT_NAME, request.habitName)
            .putExtra(EXTRA_TRACK_ID, command.trackId)
            .putExtra(EXTRA_LOOP, command.loop)
            .putExtra(EXTRA_POSITION_MS, command.positionMs)
          try {
            context.startForegroundService(intent)
          } catch (e: RuntimeException) {
            // The system refused a foreground service right now: without sound the
            // timer is an orphan, and the next widget action drops it.
            Log.w(TAG, "Could not start the player", e)
            habitId = null
          }
        }
        is PlayerCommand.Pause -> mainHandler.post { instance?.pausePlayback() }
        is PlayerCommand.StopAll -> {
          habitId = null
          mainHandler.post { instance?.stopPlayback() }
        }
        is PlayerCommand.Stop -> {
          if (habitId == request.habitId) habitId = null
          mainHandler.post { instance?.takeIf { it.playingHabitId == request.habitId }?.stopPlayback() }
        }
      }
    }
  }
}
