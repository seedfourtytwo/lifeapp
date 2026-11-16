package expo.modules.lifewidget

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
  }
}
