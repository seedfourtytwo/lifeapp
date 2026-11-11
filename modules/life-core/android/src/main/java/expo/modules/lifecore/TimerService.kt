package expo.modules.lifecore

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.RawResourceDataSource
import androidx.media3.exoplayer.ExoPlayer

/**
 * Plays the running habit timer, foreground with type `mediaPlayback`: the
 * habit's track (looping, or once), or the silent keepalive for a habit
 * without one; the chime and an exact alarm at a seconds goal; a heartbeat
 * every 30 s while running; the ongoing notification with Pause/Resume and
 * Done. The session itself lives in [TimerCore]; this service only follows
 * it, so the app, the notification and the track's end all agree.
 *
 * Not sticky: if the process dies the service is not brought back with
 * sound; the next process finds the session paused at its last heartbeat.
 */
class TimerService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private lateinit var player: ExoPlayer
  private lateinit var chime: ExoPlayer
  /** The resource and loop setting the player holds, so a pause and resume keep its place. */
  private var loaded: Pair<Int, Boolean>? = null
  private var trackId: String? = null
  private var chimeRinging = false
  /** The session ended while the chime rings: stop once it has rung. */
  private var stopAfterChime = false

  private val onChange: (TimerSession?) -> Unit = { session -> main.post { follow(session) } }

  private val heartbeat = object : Runnable {
    override fun run() {
      TimerCore.heartbeat(this@TimerService)
      main.postDelayed(this, TimerSession.HEARTBEAT_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    TimerNotification.ensureChannel(this)
    player = ExoPlayer.Builder(this)
      .setWakeMode(C.WAKE_MODE_LOCAL)
      .setHandleAudioBecomingNoisy(true)
      .build()
    player.addListener(trackListener)
    chime = ExoPlayer.Builder(this).build().apply {
      // Rings over the track rather than taking the focus from it.
      setAudioAttributes(mediaAttributes(), false)
      setMediaItem(MediaItem.fromUri(RawResourceDataSource.buildRawResourceUri(HabitSounds.chime)))
      addListener(object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
          if (state != Player.STATE_ENDED) return
          chimeRinging = false
          if (stopAfterChime) stopNow()
        }
      })
    }
    TimerCore.addListener(onChange)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A start through startForegroundService must reach startForeground
    // within seconds, even when the session is already gone.
    val current = TimerCore.state(this)
    ServiceCompat.startForeground(
      this,
      TimerNotification.ID,
      current?.let { TimerNotification.build(this, it, System.currentTimeMillis()) } ?: TimerNotification.placeholder(this),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )
    when (intent?.action) {
      ACTION_PAUSE -> TimerCore.pause(this)
      ACTION_RESUME -> TimerCore.resume(this)
      ACTION_DONE -> TimerCore.finish(this, markComplete = true, trackCompleted = false)
      ACTION_GOAL -> if (TimerCore.reachGoal(this)) ring()
    }
    follow(TimerCore.state(this))
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    TimerCore.removeListener(onChange)
    main.removeCallbacksAndMessages(null)
    cancelGoalAlarm()
    player.release()
    chime.release()
    super.onDestroy()
  }

  private fun mediaAttributes(): AudioAttributes = AudioAttributes.Builder()
    .setUsage(C.USAGE_MEDIA)
    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
    .build()

  /** Sound, alarm, heartbeat and notification as the session now stands. */
  private fun follow(session: TimerSession?) {
    main.removeCallbacks(heartbeat)
    cancelGoalAlarm()
    if (session == null) {
      player.stop()
      if (chimeRinging) stopAfterChime = true else stopNow()
      return
    }
    play(session)
    if (!session.isPaused) {
      main.postDelayed(heartbeat, TimerSession.HEARTBEAT_MS)
      session.goalAtMs()?.let(::armGoalAlarm)
    }
    ServiceCompat.startForeground(
      this,
      TimerNotification.ID,
      TimerNotification.build(this, session, System.currentTimeMillis()),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )
  }

  private fun play(session: TimerSession) {
    val track = session.request.trackId?.let(HabitSounds.tracks::get)
    if (trackId != session.request.trackId || loaded == null) {
      trackId = session.request.trackId
      // A track played once picks up where the session is, so a session
      // resumed after the process died does not hear its track from the top.
      val startMs = if (track != null && !session.request.loop) session.activeMs(System.currentTimeMillis()) else 0L
      load(track?.let { it to session.request.loop } ?: (HabitSounds.keepalive to true), startMs)
    }
    player.playWhenReady = !session.isPaused
  }

  private fun load(source: Pair<Int, Boolean>, startMs: Long = 0L) {
    if (loaded == source) return
    loaded = source
    val keepalive = source.first == HabitSounds.keepalive
    // A habit's track takes the audio focus, so a call or other media pauses
    // the session; the silent keepalive must not stop someone's music.
    player.setAudioAttributes(mediaAttributes(), !keepalive)
    player.volume = if (keepalive) 0f else 1f
    player.repeatMode = if (source.second) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    player.setMediaItem(MediaItem.fromUri(RawResourceDataSource.buildRawResourceUri(source.first)), startMs)
    player.prepare()
  }

  private val trackListener = object : Player.Listener {
    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
      val lostFocus = reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS
      val unplugged = reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY
      if (!playWhenReady && (lostFocus || unplugged)) TimerCore.pause(this@TimerService)
    }

    override fun onPlaybackSuppressionReasonChanged(reason: Int) {
      // A call takes the focus for a while; the session pauses and waits for
      // Resume rather than picking the track up again by itself.
      if (reason == Player.PLAYBACK_SUPPRESSION_REASON_TRANSIENT_AUDIO_FOCUS_LOSS) TimerCore.pause(this@TimerService)
    }

    override fun onPlaybackStateChanged(state: Int) {
      if (state != Player.STATE_ENDED || loaded?.first == HabitSounds.keepalive) return
      val session = TimerCore.state(this@TimerService) ?: return
      if (session.request.goal is TimerGoal.PlayOnce) {
        // The track is the goal: its end finishes the session.
        ring()
        TimerCore.finish(this@TimerService, markComplete = false, trackCompleted = true)
      } else {
        // A track shorter than the goal ended: the session runs on, kept awake in silence.
        load(HabitSounds.keepalive to true)
        player.playWhenReady = !session.isPaused
      }
    }
  }

  private fun ring() {
    chimeRinging = true
    chime.seekTo(0)
    chime.prepare()
    chime.play()
  }

  private fun goalIntent(): PendingIntent = PendingIntent.getService(
    this,
    REQUEST_GOAL,
    Intent(this, TimerService::class.java).setAction(ACTION_GOAL),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  /** Rings even with the screen off and the phone dozing; USE_EXACT_ALARM grants the exact form. */
  private fun armGoalAlarm(atMs: Long) {
    val alarms = getSystemService(AlarmManager::class.java)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    if (exact) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, goalIntent())
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, goalIntent())
    }
  }

  private fun cancelGoalAlarm() {
    getSystemService(AlarmManager::class.java).cancel(goalIntent())
  }

  private fun stopNow() {
    stopAfterChime = false
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  companion object {
    const val ACTION_PAUSE = "expo.modules.lifecore.PAUSE"
    const val ACTION_RESUME = "expo.modules.lifecore.RESUME"
    const val ACTION_DONE = "expo.modules.lifecore.DONE"
    const val ACTION_GOAL = "expo.modules.lifecore.GOAL"
    private const val REQUEST_GOAL = 10
  }
}
