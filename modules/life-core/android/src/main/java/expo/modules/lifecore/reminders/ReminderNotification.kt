package expo.modules.lifecore.reminders

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.lifecore.AppLanguage
import expo.modules.lifecore.R
import expo.modules.lifecore.widget.WidgetActionReceiver

/**
 * A habit reminder: "Habit reminder · Time for <name>" in the app's
 * language. A locked phone that hides notification content shows the
 * public version, which names the habit's lock-screen name, or nothing
 * when it has none (the system's "content hidden"). A check-off habit gets
 * Done, which ticks it through the widget's own path, locked or not.
 */
object ReminderNotification {
  const val CHANNEL_ID = "life_core_reminders"
  /** One notification per habit: the habit's id is the tag, so a later reminder replaces it. */
  private const val ID = 6_002

  private fun ensureChannel(context: Context, words: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // The same importance as the "reminders" channel the app's other reminders use.
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, words.getString(R.string.life_core_reminder_channel), NotificationManager.IMPORTANCE_HIGH),
    )
  }

  private fun openApp(context: Context): PendingIntent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

  private fun builder(context: Context, words: Context, post: ReminderPost, name: String): NotificationCompat.Builder {
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.life_core_timer)
      .setContentTitle(words.getString(R.string.life_core_reminder_title))
      .setContentText(words.getString(R.string.life_core_reminder_body, name))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(openApp(context))
    if (post.offerDone) {
      builder.addAction(
        NotificationCompat.Action.Builder(
          0,
          words.getString(R.string.life_core_reminder_done),
          WidgetActionReceiver.reminderDoneIntent(context, post.habit.id),
        )
          // Ticks from the lock screen without asking for the unlock first.
          .setAuthenticationRequired(false)
          .setShowsUserInterface(false)
          .build(),
      )
    }
    return builder
  }

  private fun build(context: Context, words: Context, post: ReminderPost): Notification {
    val builder = builder(context, words, post, post.habit.name).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
    post.habit.lockScreenName?.let { builder.setPublicVersion(builder(context, words, post, it).build()) }
    return builder.build()
  }

  fun post(context: Context, language: String?, post: ReminderPost) {
    val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    val manager = NotificationManagerCompat.from(context)
    // Permission withdrawn since JavaScript wrote the plan: nothing to post.
    if (!allowed || !manager.areNotificationsEnabled()) return
    val words = AppLanguage.localized(context, language)
    ensureChannel(context, words)
    manager.notify(post.habit.id, ID, build(context, words, post))
  }

  /** The habit was ticked from its reminder. */
  fun cancel(context: Context, habitId: String) {
    NotificationManagerCompat.from(context).cancel(habitId, ID)
  }

  /** The habits whose reminder is on screen now, as the system holds them (so a new process knows too). */
  fun posted(context: Context): Set<String> =
    context.getSystemService(NotificationManager::class.java).activeNotifications
      .filter { it.id == ID }
      .mapNotNull { it.tag }
      .toSet()
}
