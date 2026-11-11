package expo.modules.lifewidgetspike

import android.app.Activity
import android.os.Bundle

// THROWAWAY: logs that the activity PendingIntent actually launched, then opens the app.
class SpikeActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      SpikeLog.line(this, "SpikeActivity.onCreate (activity PendingIntent fired)")
      packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
    } catch (t: Throwable) {
      SpikeLog.line(this, "SpikeActivity EXCEPTION ${t.javaClass.name}: ${t.message}")
    }
    finish()
  }

  override fun onResume() {
    super.onResume()
    SpikeLog.line(this, "SpikeActivity.onResume")
  }
}
