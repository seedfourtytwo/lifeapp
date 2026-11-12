package expo.modules.lifecore.widget

import expo.modules.lifecore.widget.WidgetFixtures.KEFIR
import expo.modules.lifecore.widget.WidgetFixtures.MEDITATION
import expo.modules.lifecore.widget.WidgetFixtures.WATER
import expo.modules.lifecore.widget.WidgetFixtures.id
import expo.modules.lifecore.widget.WidgetFixtures.march10
import expo.modules.lifecore.widget.WidgetFixtures.ms
import expo.modules.lifecore.widget.WidgetFixtures.paris
import expo.modules.lifecore.widget.WidgetFixtures.snapshot
import expo.modules.lifecore.widget.WidgetFixtures.tenAm
import expo.modules.lifecore.TimerSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetViewsTest {
  private fun keyguard(
    lines: List<QueuedAction> = emptyList(),
    now: Long = tenAm,
    timer: TimerSession? = null,
    from: Snapshot? = snapshot,
  ) = WidgetViews.build(from, timer, lines, now, paris, KeyguardLabels)

  private fun homeScreen(lines: List<QueuedAction> = emptyList(), now: Long = tenAm, timer: TimerSession? = null) =
    WidgetViews.build(snapshot, timer, lines, now, paris, HomeScreenLabels)

  private fun tick(trackerId: String) = QueuedAction.HabitComplete(id(), tenAm - 1000, march10, trackerId)

  private val meditationDone = QueuedAction.TimerSessionDone(id(), tenAm - 1000, march10, MEDITATION, 900, false, false)

  private fun <L : Label> home(frame: WidgetFrame<L>) = frame.view as WidgetView.Home<L>

  @Test
  fun aSessionShowsTheTimerWhateverElseIsTrue() {
    val session = WidgetFixtures.timerSession()
    val frame = keyguard(timer = session, now = ms("2026-03-10T08:10:00.000Z"))
    val view = frame.view as WidgetView.Timer
    assertEquals("Sit", view.label.lockScreenName)
    assertEquals("meditation", view.label.icon)
    assertFalse(view.running)
    // Paused at 08:05:00.250 after 30 s of pauses: 4 min 30.25 s.
    assertEquals(270_250L, view.activeMs)
    // 900 s goal, 120 s logged before it.
    assertEquals(780_000L, view.goalMs)
    // The timer shows even with no snapshot to read.
    assertTrue(keyguard(timer = session, from = null).view is WidgetView.Timer)

    val named = homeScreen(timer = session).view as WidgetView.Timer
    assertEquals("Meditation", named.label.name)
  }

  @Test
  fun noSnapshotShowsOnlyOpenLife() {
    assertEquals(WidgetFrame(WidgetView.Empty, null), keyguard(from = null))
  }

  @Test
  fun homeShowsTimeClearTodayTheRoadAndTheNextThing() {
    val view = home(keyguard())
    assertEquals(HomeTop.Clear(ClearTime.DaysHours(3, 0), "Clear", done = 2, due = 6), view.top)
    assertEquals(RoadNote(LampLabel.Days(5), ClearTime.DaysHours(1, 23), riddenOut = 12), view.note)
    // The commitment's last seven days: a slip on the 7th.
    assertEquals(listOf(1.0, 1.0, 1.0, 0.16, 1.0, 1.0, 1.0), view.road.dashes)
    assertEquals(WidgetViews.CAR_AT, view.road.carAt, 0.0)
    val next = view.next as NextUp.Action
    assertEquals(NextButton.Play(MEDITATION), next.button)
    assertEquals("Sit", next.label.lockScreenName)
  }

  @Test
  fun theNextThingIsTheFirstDueNotDoneAndShownNow() {
    val kefir = home(keyguard(listOf(meditationDone))).next as NextUp.Action
    assertEquals(NextButton.Tick(KEFIR), kefir.button)
    // No lock-screen name: the icon only.
    assertNull(kefir.label.lockScreenName)
    assertEquals("bottle-tonic-plus-outline", kefir.label.icon)
    // The face routine is hidden before 21:00, so water is next, with its first button.
    val water = home(keyguard(listOf(meditationDone, tick(KEFIR)))).next as NextUp.Action
    assertEquals(NextButton.Add(WATER, 1.0), water.button)
  }

  @Test
  fun nothingLeftShowsHisOwnLine() {
    val evening = ms("2026-03-10T22:30:00.000Z")
    val lines = listOf(
      QueuedAction.TimerSessionDone(id(), evening - 5000, march10, MEDITATION, 900, false, false),
      QueuedAction.HabitComplete(id(), evening - 4000, march10, KEFIR),
      QueuedAction.HabitComplete(id(), evening - 3000, march10, WidgetFixtures.FACE),
      QueuedAction.CounterAdd(id(), evening - 2000, march10, WATER, 3.0),
    )
    assertEquals(NextUp.OwnLine("I sleep better"), home(keyguard(lines, evening)).next)
    val noLines = snapshot.copy(commitment = snapshot.commitment?.copy(ownLines = emptyList()))
    assertEquals(NextUp.AllDone, home(keyguard(lines, evening, from = noLines)).next)
  }

  @Test
  fun withoutACommitmentTheCountLeadsAndEachDashIsTheDaysShare() {
    val none = snapshot.copy(commitment = null, trackers = snapshot.trackers.filter { it.kind != TrackerKind.COMMITMENT })
    val view = home(keyguard(from = none))
    assertEquals(HomeTop.Count(done = 1, due = 5, bestStreak = 3), view.top)
    assertNull(view.note)
    assertNull(view.road.lampAt)
    // 4 March: meditation and water done, the other three not: two of five.
    assertEquals(0.16 + 0.84 * 2 / 5, requireNotNull(view.road.dashes.first()), 1e-9)
    // Two days on, the streaks cannot be known.
    assertEquals(HomeTop.Count(done = 0, due = 5, bestStreak = null), home(keyguard(now = ms("2026-03-12T09:00:00.000Z"), from = none)).top)
  }

  @Test
  fun anUrgeRidesToTheLampWithItsInsteadHabit() {
    val urge = QueuedAction.UrgeLogged(id(), tenAm, march10)
    val frame = keyguard(listOf(urge), tenAm + 300_000)
    val view = frame.view as WidgetView.Riding
    assertEquals(Ride(urge.id, tenAm, tenAm + 600_000), view.ride)
    assertEquals(MEDITATION, view.instead?.trackerId)
    assertEquals("Sit", view.instead?.label?.lockScreenName)
    assertEquals(900, view.instead?.goalSeconds)
    // Half way: the lamp is half way down the road.
    assertEquals(WidgetViews.CAR_AT + 0.8 * 0.5, requireNotNull(view.road.lampAt), 1e-9)
    assertEquals(tenAm + 600_000, frame.redrawAtMs)
    // Once it ends, home again.
    assertTrue(keyguard(listOf(urge), tenAm + 600_000).view is WidgetView.Home)
  }

  @Test
  fun aRideWithoutAnInsteadHabitOffersNone() {
    val none = snapshot.copy(commitment = snapshot.commitment?.copy(insteadHabits = emptyList()))
    val urge = QueuedAction.UrgeLogged(id(), tenAm, march10)
    assertNull((keyguard(listOf(urge), tenAm + 1000, from = none).view as WidgetView.Riding).instead)
  }

  @Test
  fun redrawsWhenTheClockAloneChangesWhatShows() {
    // 3d 0h 30m clear: the words change at 3d 1h, half an hour on; the lamp countdown too.
    assertEquals(tenAm + 30 * 60_000, keyguard().redrawAtMs)
    // Under a day clear, every minute.
    val fresh = snapshot.copy(commitment = snapshot.commitment?.copy(clearSinceMs = tenAm - 90_500))
    assertEquals(tenAm + 29_500, keyguard(from = fresh).redrawAtMs)
    // Without a commitment: the face routine's window at 21:00, then midnight.
    val none = snapshot.copy(commitment = null)
    assertEquals(ms("2026-03-10T20:00:00.000Z"), keyguard(from = none).redrawAtMs)
    assertEquals(ms("2026-03-10T23:00:00.000Z"), keyguard(now = ms("2026-03-10T22:30:00.000Z"), from = none).redrawAtMs)
  }

  @Test
  fun theHomeScreenNamesTrackersAndTheLockScreenNever() {
    val named = home(homeScreen()).next as NextUp.Action
    assertEquals("Meditation", named.label.name)
    val names = snapshot.trackers.map { it.name }.toSet()
    val lines = listOf(meditationDone, tick(KEFIR))
    for (frame in listOf(keyguard(), keyguard(listOf(meditationDone)), keyguard(lines))) {
      val label = (home(frame).next as? NextUp.Action)?.label ?: continue
      assertFalse(label.lockScreenName in names)
    }
  }
}
