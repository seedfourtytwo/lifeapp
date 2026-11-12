package expo.modules.lifecore.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RoadSceneTest {
  private val week = Road(listOf(1.0, 1.0, 0.16, 1.0, null, 1.0, 1.0), lampAt = 0.8, carAt = WidgetViews.CAR_AT)

  private fun RoadShape.inside(width: Int, height: Int): Boolean = when (this) {
    is RoadShape.Polygon -> xs.all { it in 0f..width.toFloat() } && ys.all { it in 0f..height.toFloat() }
    is RoadShape.Line -> listOf(x1, x2).all { it in 0f..width.toFloat() } && listOf(y1, y2).all { it in 0f..height.toFloat() }
    is RoadShape.Circle -> cx - radius >= 0 && cx + radius <= width && cy - radius >= 0 && cy + radius <= height
  }

  @Test
  fun drawsTheRoadADashPerCountedDayTheLampAndTwoTailLights() {
    val shapes = RoadScene.shapes(week, 1100, 250)
    assertEquals(1, shapes.count { it is RoadShape.Polygon })
    // Six dashes: the day before the tracker existed has none.
    val dashes = shapes.filterIsInstance<RoadShape.Line>().filter { it.color and 0xFFFFFF == RoadScene.CREAM and 0xFFFFFF }
    assertEquals(6, dashes.size)
    assertEquals(listOf(RoadScene.LAMP, RoadScene.TAIL, RoadScene.TAIL), shapes.filterIsInstance<RoadShape.Circle>().map { it.color })
  }

  @Test
  fun aMissedDayIsDimAndNeverGone() {
    val dashes = RoadScene.shapes(week, 1100, 250).filterIsInstance<RoadShape.Line>().filter { it.color and 0xFFFFFF == RoadScene.CREAM and 0xFFFFFF }
    assertEquals(listOf(255, 255, 40, 255, 255, 255), dashes.map { it.color ushr 24 })
  }

  @Test
  fun nearerDaysAreWiderAndLower() {
    val dashes = RoadScene.shapes(week, 1100, 250).filterIsInstance<RoadShape.Line>().filter { it.color and 0xFFFFFF == RoadScene.CREAM and 0xFFFFFF }
    assertTrue(dashes.zipWithNext().all { (near, far) -> near.width > far.width && near.y1 > far.y1 })
  }

  @Test
  fun everythingStaysInsideTheBitmapWhateverItsShape() {
    for ((width, height) in listOf(1100 to 250, 1100 to 120, 400 to 300, 300 to 60)) {
      for (road in listOf(week, Road(emptyList(), lampAt = 0.95, carAt = WidgetViews.CAR_AT), Road(emptyList(), null, WidgetViews.CAR_AT))) {
        assertTrue("$width x $height", RoadScene.shapes(road, width, height).all { it.inside(width, height) })
      }
    }
  }

  @Test
  fun theLampComesCloserAsTheRideGoesOn() {
    fun lampY(distance: Double) = RoadScene.shapes(Road(emptyList(), distance, WidgetViews.CAR_AT), 1100, 250)
      .filterIsInstance<RoadShape.Circle>().first { it.color == RoadScene.LAMP }.cy
    assertTrue(lampY(0.7) > lampY(0.9))
  }
}
