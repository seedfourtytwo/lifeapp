package expo.modules.lifecore

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The files in `modules/life-core/fixtures` are read by this test and by
 * `__tests__/coreTimerFixtures.test.ts`, so Kotlin and the Zod schemas are
 * held to the very same JSON.
 */
class SharedFixturesTest {
  private fun fixture(name: String) = File("../fixtures/$name").readText()

  /** Field by field, numbers as text, so 30000 and 30000L compare equal. */
  private fun canonical(text: String): Map<String, Any> = canonical(JSONObject(text))

  private fun canonical(json: JSONObject): Map<String, Any> =
    json.keys().asSequence().associateWith { key ->
      when (val value = json.get(key)) {
        is JSONObject -> canonical(value)
        else -> value.toString()
      }
    }

  @Test
  fun timerStateRoundTripsUnchanged() {
    val text = fixture("timer-state.json")
    assertEquals(canonical(text), canonical(TimerJson.encodeSession(TimerJson.decodeSession(text))))
  }

  @Test
  fun aFinishedSessionEncodesToTheSharedLine() {
    val t0 = 1_773_129_600_000L
    val session = TimerSession.start(
      TimerJson.decodeSession(fixture("timer-state.json")).request,
      t0,
      "2026-03-10",
    ).pause(t0 + 60_000).resume(t0 + 90_000)
    val record = session.finish(t0 + 1_200_000, "2026-03-10", "6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11", markComplete = true, trackCompleted = false)

    assertEquals(canonical(fixture("timer-session-line.json")), canonical(TimerJson.encodeRecord(record)))
  }
}
