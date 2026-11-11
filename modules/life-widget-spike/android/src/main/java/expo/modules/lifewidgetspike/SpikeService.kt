package expo.modules.lifewidgetspike

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper

// THROWAWAY: specialUse foreground service; logs every 5 s for 60 s, then stops.
class SpikeService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var ticks = 0

  private val tick = object : Runnable {
    override fun run() {
      ticks += 5
      SpikeLog.line(this@SpikeService, "SpikeService tick t=${ticks}s")
      if (ticks >= 60) {
        SpikeLog.line(this@SpikeService, "SpikeService done, stopping")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      } else handler.postDelayed(this, 5000)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    SpikeLog.line(this, "SpikeService.onStartCommand startId=$startId")
    try {
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel("life_spike", "Life spike", NotificationManager.IMPORTANCE_LOW),
      )
      val n = Notification.Builder(this, "life_spike")
        .setContentTitle("Life spike service")
        .setContentText("Running 60 s test")
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setOngoing(true)
        .build()
      startForeground(4711, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      SpikeLog.line(this, "SpikeService startForeground OK notificationsEnabled=${nm.areNotificationsEnabled()}")
    } catch (t: Throwable) {
      SpikeLog.line(this, "SpikeService startForeground THREW ${t.javaClass.name}: ${t.message}")
      stopSelf()
      return START_NOT_STICKY
    }
    handler.removeCallbacks(tick)
    ticks = 0
    handler.postDelayed(tick, 5000)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    SpikeLog.line(this, "SpikeService.onDestroy ticks=$ticks")
    super.onDestroy()
  }
}
