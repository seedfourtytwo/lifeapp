package expo.modules.lifecore

import org.json.JSONException
import java.io.File
import java.time.format.DateTimeParseException

/**
 * `files/widget/timer.json`: the running session, replaced in one rename on
 * every transition so a reader (the app, the widget) gets either the old
 * file or the new one, never half of either.
 */
class TimerFile(private val file: File) {
  /** The saved session, or null when there is none or it does not read. */
  fun read(): TimerSession? {
    if (!file.exists()) return null
    return try {
      TimerJson.decodeSession(file.readText())
    } catch (_: JSONException) {
      null
    } catch (_: IllegalArgumentException) {
      null
    } catch (_: DateTimeParseException) {
      null
    }
  }

  fun write(session: TimerSession) {
    file.parentFile?.mkdirs()
    val temporary = File(file.parentFile, "${file.name}.tmp")
    temporary.writeText(TimerJson.encodeSession(session))
    if (!temporary.renameTo(file)) {
      temporary.delete()
      throw java.io.IOException("Could not replace ${file.path}")
    }
  }

  fun delete() {
    file.delete()
  }
}
