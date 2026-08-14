import ExpoModulesCore

public class LifeMoonshineDictationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LifeMoonshineDictation")

    Function("isSupported") { () -> Bool in
      false
    }

    AsyncFunction("prepare") { (promise: Promise) in
      promise.reject("UNSUPPORTED", "Moonshine dictation is Android-only in v1")
    }

    AsyncFunction("warm") { (_: Promise) in
    }

    AsyncFunction("start") { (promise: Promise) in
      promise.reject("UNSUPPORTED", "Moonshine dictation is Android-only in v1")
    }

    AsyncFunction("stop") { (promise: Promise) in
      promise.reject("UNSUPPORTED", "Moonshine dictation is Android-only in v1")
    }

    AsyncFunction("abort") { (_: Promise) in
    }

    AsyncFunction("deleteLegacySpeechModels") { (_: Promise) in
    }
  }
}
