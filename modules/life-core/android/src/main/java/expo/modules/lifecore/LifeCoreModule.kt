package expo.modules.lifecore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The native core's bridge to JavaScript: the running timer lives here, not in React Native. */
class LifeCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LifeCore")

    Events(EVENT_STATE_CHANGE)

    AsyncFunction("getState") { -> null as String? }
  }

  private companion object {
    const val EVENT_STATE_CHANGE = "onStateChange"
  }
}
