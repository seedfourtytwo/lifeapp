package expo.modules.lifecore.widget

import expo.modules.lifecore.TimerJson
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** The shared snapshot fixture (Tuesday 10 March 2026, Paris) and helpers around it. */
object WidgetFixtures {
  val paris: ZoneId = ZoneId.of("Europe/Paris")

  const val MEDITATION = "550e8400-e29b-41d4-a716-446655441001"
  const val KEFIR = "550e8400-e29b-41d4-a716-446655441002"
  const val MOBILITY = "550e8400-e29b-41d4-a716-446655441006"
  const val FACE = "550e8400-e29b-41d4-a716-446655441007"
  const val WATER = "550e8400-e29b-41d4-a716-446655441008"
  const val COMMITMENT = "550e8400-e29b-41d4-a716-446655441301"

  val text: String get() = File("../fixtures/widget-snapshot.json").readText()

  val snapshot: Snapshot get() = requireNotNull(SnapshotJson.parse(text))

  fun ms(instant: String): Long = Instant.parse(instant).toEpochMilli()

  /** 10:00 in Paris on the snapshot's day. */
  val tenAm: Long = ms("2026-03-10T09:00:00.000Z")

  val march10: LocalDate = LocalDate.parse("2026-03-10")

  fun timerSession() = TimerJson.decodeSession(File("../fixtures/timer-state.json").readText())

  private var ids = 0

  fun id(): String = "00000000-0000-4000-8000-%012d".format(++ids)
}
