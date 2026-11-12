package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerGoal
import expo.modules.lifecore.widget.WidgetFixtures.COMMITMENT
import expo.modules.lifecore.widget.WidgetFixtures.FACE
import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.WATER
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.tenAm
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.time.LocalTime

class SnapshotAndQueueTest {
  @Test
  fun readsTheSnapshotTheAppWrites() {
    val snapshot = WidgetFixtures.snapshot
    assertEquals(march10, snapshot.date)
    assertEquals(WidgetFixtures.paris, snapshot.zone)
    assertEquals(listOf(MEDITATION, KEFIR, WidgetFixtures.MOBILITY, FACE, WATER, COMMITMENT), snapshot.trackers.map { it.id })
    val meditation = snapshot.trackers.first()
    assertEquals(SnapshotTimer(TimerGoal.Seconds(900), "meditation15min", true), meditation.timer)
    assertEquals(DoneRule.Timer(TimerGoal.Seconds(900)), meditation.rule)
    assertEquals(DoneRule.CheckOff, snapshot.trackers[1].rule)
    assertEquals(LocalTime.of(21, 0) to LocalTime.of(23, 0), snapshot.trackers[3].shownOnlyBetween)
    assertEquals(listOf(1.0, 2.0), snapshot.trackers[4].quickIncrements)
    assertEquals(DoneRule.Counter(8.0), snapshot.trackers[4].rule)
    assertEquals(listOf("Money for the trip", "I sleep better"), snapshot.commitment?.ownLines)
    assertEquals(listOf(InsteadHabit(MEDITATION, "Sit", "meditation")), snapshot.commitment?.insteadHabits)
    assertNull(snapshot.ride)
  }

  @Test
  fun showsNothingRatherThanGuess() {
    assertNull(SnapshotJson.parse(""))
    assertNull(SnapshotJson.parse("{\"version\":"))
    assertNull(SnapshotJson.parse(WidgetFixtures.text.replace("\"version\": 3", "\"version\": 2")))
    assertNull(SnapshotJson.parse(WidgetFixtures.text.replace("\"Europe/Paris\"", "\"Mars/Olympus\"")))
  }

  @Test
  fun writesEachTapAsALineAndReadsItBack() {
    val actions = listOf(
      QueuedAction.HabitComplete(WidgetFixtures.id(), tenAm, march10, KEFIR),
      QueuedAction.CounterAdd(WidgetFixtures.id(), tenAm, march10, WATER, 2.0),
      QueuedAction.UrgeLogged(WidgetFixtures.id(), tenAm, march10),
      QueuedAction.UrgeResolved(WidgetFixtures.id(), tenAm + 1000, march10, "7a0e4c2d-1b3f-4e5a-9c6d-8f2e1a3b4c5d"),
    )
    val lines = actions.map(QueueLines::encode)
    val tick = JSONObject(lines[0])
    assertEquals(
      mapOf("v" to "1", "id" to actions[0].id, "at" to "2026-03-10T09:00:00.000Z", "day" to "2026-03-10", "type" to "habit_complete", "trackerId" to KEFIR),
      tick.keys().asSequence().associateWith { tick.get(it).toString() },
    )
    assertEquals("used", JSONObject(lines[3]).getString("outcome"))
    assertEquals(actions, QueueLines.parse(lines.joinToString("\n", postfix = "\n")))
  }

  @Test
  fun readsAFinishedSessionLine() {
    val line = File("../fixtures/timer-session-line.json").readText().replace(Regex("\\s*\n\\s*"), "")
    assertEquals(
      listOf(
        QueuedAction.TimerSessionDone(
          "6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11",
          WidgetFixtures.ms("2026-03-10T08:20:00.000Z"),
          march10,
          "550e8400-e29b-41d4-a716-446655440001",
          1170,
          trackCompleted = false,
          markComplete = true,
        ),
      ),
      QueueLines.parse("$line\n"),
    )
  }

  @Test
  fun skipsWhatDoesNotRead() {
    val good = QueueLines.encode(QueuedAction.UrgeLogged(WidgetFixtures.id(), tenAm, march10))
    val text = listOf(
      "not json",
      "{\"v\":2,\"id\":\"x\",\"at\":\"2026-03-10T09:00:00.000Z\",\"day\":\"2026-03-10\",\"type\":\"urge_logged\"}",
      "{\"v\":1,\"id\":\"x\",\"at\":\"2026-03-10T09:00:00.000Z\",\"day\":\"2026-03-10\",\"type\":\"timer_start\"}",
      "{\"v\":1,\"id\":\"x\",\"at\":\"2026-03-10T09:00:00.000Z\",\"day\":\"2026-03-10\",\"type\":\"urge_resolved\",\"urgeId\":\"y\",\"outcome\":\"rode_out\"}",
      good,
    ).joinToString("\n", postfix = "\n")
    assertEquals(1, QueueLines.parse(text).size)
    // A line still being written, after the last newline, waits for the next read.
    assertEquals(1, QueueLines.parse(text + good.take(20)).size)
    assertEquals(emptyList<QueuedAction>(), QueueLines.parse(good))
  }
}
