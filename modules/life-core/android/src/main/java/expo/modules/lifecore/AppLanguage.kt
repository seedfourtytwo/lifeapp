package expo.modules.lifecore

import android.content.Context
import android.content.res.Configuration
import expo.modules.lifecore.reminders.Reminders
import java.util.Locale

/**
 * The app's language setting, which can differ from the phone's: JavaScript
 * writes it into the reminder plan, and every native notification takes
 * its words from a context in that language. Without a plan, the phone's.
 */
object AppLanguage {
  fun localized(context: Context, language: String? = Reminders.plan(context)?.language): Context {
    if (language == null) return context
    val configuration = Configuration(context.resources.configuration)
    configuration.setLocale(Locale.forLanguageTag(language))
    return context.createConfigurationContext(configuration)
  }
}
