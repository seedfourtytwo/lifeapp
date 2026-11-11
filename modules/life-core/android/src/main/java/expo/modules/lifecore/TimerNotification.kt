package expo.modules.lifecore

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/**
 * The running timer's ongoing notification: a chronometer, Pause or Resume,
 * and Done. A locked phone that hides notification content shows the public
 * version, which names only the lock-screen name, or "Timer".
 *
 * Not a promoted "Live Update": the request for promotion
 * (`Notification.EXTRA_REQUEST_PROMOTED_ONGOING`, `setRequestPromotedOngoing`)
 * is not in the SDK this app compiles against (android-36); it first appears
 * in android-37. This is the standard ongoing chronometer notification.
 */
object TimerNotification {
  const val CHANNEL_ID = "life_core_timer"
  const val ID = 6_001

  fun ensureChannel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.life_core_timer_channel),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun clock(seconds: Long): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val rest = seconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, rest) else "%d:%02d".format(minutes, rest)
  }

  private fun action(context: Context, action: String, requestCode: Int): PendingIntent = PendingIntent.getService(
    context,
    requestCode,
    Intent(context, TimerService::class.java).setAction(action),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  private fun openApp(context: Context): PendingIntent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

  private fun builder(context: Context, session: TimerSession, title: String, nowMs: Long): NotificationCompat.Builder {
    val goal = (session.request.goal as? TimerGoal.Seconds)?.let {
      context.getString(R.string.life_core_timer_goal, clock(it.seconds.toLong()))
    }
    val activeMs = session.activeMs(nowMs)
    val text = when {
      session.isPaused -> context.getString(R.string.life_core_timer_paused, clock(activeMs / 1000))
      session.goalReachedAtMs != null -> context.getString(R.string.life_core_timer_goal_reached)
      else -> listOfNotNull(context.getString(R.string.life_core_timer_running), goal).joinToString(" · ")
    }
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.life_core_timer)
      .setContentTitle(title)
      .setContentText(text)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setContentIntent(openApp(context))
    if (session.isPaused) {
      builder.setShowWhen(false).setUsesChronometer(false)
      builder.addAction(0, context.getString(R.string.life_core_timer_resume), action(context, TimerService.ACTION_RESUME, 2))
    } else {
      // The chronometer counts from `when` on its own; nothing is posted per second.
      builder.setShowWhen(true).setUsesChronometer(true).setWhen(nowMs - activeMs)
      builder.addAction(0, context.getString(R.string.life_core_timer_pause), action(context, TimerService.ACTION_PAUSE, 1))
    }
    builder.addAction(0, context.getString(R.string.life_core_timer_done), action(context, TimerService.ACTION_DONE, 3))
    return builder
  }

  fun build(context: Context, session: TimerSession, nowMs: Long): Notification {
    val publicTitle = session.request.lockScreenName ?: context.getString(R.string.life_core_timer_public_title)
    return builder(context, session, session.request.name, nowMs)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(builder(context, session, publicTitle, nowMs).build())
      .build()
  }

  /** What the service shows for the moment between a start request and the session it finds gone. */
  fun placeholder(context: Context): Notification = NotificationCompat.Builder(context, CHANNEL_ID)
    .setSmallIcon(R.drawable.life_core_timer)
    .setContentTitle(context.getString(R.string.life_core_timer_public_title))
    .setSilent(true)
    .build()
}
