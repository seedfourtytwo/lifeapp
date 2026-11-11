package expo.modules.lifewidgetspike

import android.app.KeyguardManager
import android.content.Context
import android.os.Process
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// THROWAWAY spike logger: logcat tag LifeSpike + rolling file in filesDir.
object SpikeLog {
  const val TAG = "LifeSpike"
  private const val FILE = "lifespike.log"
  private const val MAX_BYTES = 128 * 1024

  fun line(ctx: Context, msg: String) {
    val km = ctx.getSystemService(KeyguardManager::class.java)
    val locked = km?.isKeyguardLocked
    val procAgeMs = SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime()
    val ts = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date())
    val full = "$ts pid=${Process.myPid()} procAgeMs=$procAgeMs locked=$locked $msg"
    Log.i(TAG, full)
    try {
      val f = File(ctx.filesDir, FILE)
      if (f.exists() && f.length() > MAX_BYTES) {
        val keep = f.readText().takeLast(MAX_BYTES / 2)
        f.writeText(keep)
      }
      f.appendText(full + "\n")
    } catch (e: Exception) {
      Log.e(TAG, "file append failed: ${e.javaClass.name}: ${e.message}")
    }
  }
}
