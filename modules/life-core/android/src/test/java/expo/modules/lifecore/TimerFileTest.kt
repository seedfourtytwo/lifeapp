package expo.modules.lifecore

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class TimerFileTest {
  @get:Rule
  val folder = TemporaryFolder()

  private val t0 = 1_773_129_600_000L // 2026-03-10T08:00:00Z
  private val request = TimerStartRequest(
    trackerId = "550e8400-e29b-41d4-a716-446655440001",
    name = "Méditation \"du matin\"",
    lockScreenName = null,
    iconKey = "meditation",
    goal = TimerGoal.PlayOnce(912),
    trackId = null,
    loop = false,
    loggedSeconds = 42,
  )
  private val session = TimerSession.start(request, t0, "2026-03-10").pause(t0 + 1_500)

  private fun file() = TimerFile(File(folder.root, "widget/timer.json"))

  @Test
  fun writesInstantsAsUtcWithMillisecondsLikeTheContract() {
    val json = JSONObject(TimerJson.encodeSession(session))
    assertEquals("2026-03-10T08:00:00.000Z", json.getString("startedAt"))
    assertEquals("2026-03-10T08:00:01.500Z", json.getString("pausedAt"))
    assertEquals(JSONObject.NULL, json.get("goalReachedAt"))
    assertEquals(JSONObject.NULL, json.get("lockScreenName"))
    assertEquals("play_once", json.getJSONObject("goal").getString("type"))
    assertEquals(912, json.getJSONObject("goal").getInt("trackSeconds"))
  }

  @Test
  fun readsBackWhatItWrote() {
    val file = file()
    file.write(session)
    assertEquals(session, file.read())
  }

  @Test
  fun replacesTheFileInOneRenameAndLeavesNoTemporaryBehind() {
    val file = file()
    file.write(session)
    file.write(session.resume(t0 + 10_000))
    assertEquals(session.resume(t0 + 10_000), file.read())
    assertFalse(File(folder.root, "widget/timer.json.tmp").exists())
  }

  @Test
  fun readsNothingWhenTheFileIsMissingOrDoesNotParse() {
    val file = file()
    assertNull(file.read())
    File(folder.root, "widget").mkdirs()
    File(folder.root, "widget/timer.json").writeText("{\"trackerId\":")
    assertNull(file.read())
  }

  @Test
  fun removesTheFileWhenTheSessionEnds() {
    val file = file()
    file.write(session)
    file.delete()
    assertNull(file.read())
    file.delete()
  }

  @Test
  fun decodesTheAppsStartRequest() {
    val json = """{"trackerId":"550e8400-e29b-41d4-a716-446655440001","name":"Breathing",
      "lockScreenName":"Air","iconKey":null,"goal":{"type":"seconds","seconds":600},
      "trackId":"wimhofMorning","loop":true,"loggedSeconds":0}"""
    assertEquals(
      TimerStartRequest(
        trackerId = "550e8400-e29b-41d4-a716-446655440001",
        name = "Breathing",
        lockScreenName = "Air",
        iconKey = null,
        goal = TimerGoal.Seconds(600),
        trackId = "wimhofMorning",
        loop = true,
        loggedSeconds = 0,
      ),
      TimerJson.decodeRequest(json),
    )
  }

  @Test
  fun encodesAFinishedSessionAsOneQueueLine() {
    val record = TimerSessionRecord(
      id = "6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11",
      atMs = t0 + 600_000,
      day = "2026-03-10",
      trackerId = request.trackerId,
      startedAtMs = t0,
      endedAtMs = t0 + 600_000,
      pausedMs = 0,
      activeSeconds = 600,
      goalSecondsInForce = null,
      trackCompleted = true,
      markComplete = false,
    )
    val line = TimerJson.encodeRecord(record)
    val json = JSONObject(line)

    assertFalse(line.contains('\n'))
    assertEquals(1, json.getInt("v"))
    assertEquals("timer_session", json.getString("type"))
    assertEquals("2026-03-10T08:10:00.000Z", json.getString("at"))
    assertEquals("2026-03-10T08:10:00.000Z", json.getString("endedAt"))
    assertEquals(JSONObject.NULL, json.get("goalSecondsInForce"))
    assertEquals(600L, json.getLong("activeSeconds"))
    assertEquals(true, json.getBoolean("trackCompleted"))
  }
}
