package expo.modules.lifewidget

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Runs in the app's MAIN process. It only asks the widget to refresh (a
 * broadcast to the ":widget" process); it must never open the database — see
 * WidgetDb for why.
 */
class LifeWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LifeWidget")

    Function("requestUpdate") {
      val context = appContext.reactContext
      if (context != null) {
        WidgetActions.requestUpdate(context)
      }
    }

    /**
     * Stop the widget's timer for this habit, so the app can take it over.
     * Still only a broadcast: the ":widget" process owns that table and does
     * the write. The promise waits for it, so the caller's next read sees the
     * row gone rather than racing it.
     */
    AsyncFunction("stopTimer") { habitId: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
      } else {
        WidgetActions.requestTimerStop(context, habitId) { promise.resolve(null) }
      }
    }
  }
}
