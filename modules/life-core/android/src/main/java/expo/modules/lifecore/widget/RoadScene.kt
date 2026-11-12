package expo.modules.lifecore.widget

import kotlin.math.pow

/** A flat shape of the road picture, in pixels; colours are ARGB. */
sealed interface RoadShape {
  data class Polygon(val xs: FloatArray, val ys: FloatArray, val color: Int) : RoadShape
  data class Line(val x1: Float, val y1: Float, val x2: Float, val y2: Float, val width: Float, val color: Int) : RoadShape
  data class Circle(val cx: Float, val cy: Float, val radius: Float, val color: Int) : RoadShape
}

/**
 * The Night road, flat: a road running to the horizon, a dash for each of
 * the last seven days (bright when done, dim when not, none before the
 * tracker existed), the next lamp at the roadside, and two small tail
 * lights for now. No glow, no halo: plain shapes, drawn the same by the
 * phone's Canvas and by the preview's Java2D.
 */
object RoadScene {
  const val ASPHALT = 0xE6262757.toInt()
  const val CREAM = 0xFFEFE9DC.toInt()
  const val LAMP = 0xFFFFE7B3.toInt()
  const val POST = 0xFF3A4459.toInt()
  const val TAIL = 0xFFFF4A3D.toInt()

  /** The SVG mockup's drawing box; everything scales from it. */
  private const val BOX_W = 300f
  private const val BOX_H = 120f
  private const val HORIZON_Y = 24f
  private const val VANISH_X = 0.56f
  private const val HALF_ROAD = 0.30f
  private const val DEPTH = 1.9

  private fun alpha(color: Int, alpha: Double): Int = ((alpha * 255).toInt().coerceIn(0, 255) shl 24) or (color and 0xFFFFFF)

  fun shapes(road: Road, widthPx: Int, heightPx: Int): List<RoadShape> {
    // Fit the box into the space, centred, never stretched.
    val scale = minOf(widthPx / BOX_W, heightPx / BOX_H)
    val left = (widthPx - BOX_W * scale) / 2
    val top = (heightPx - BOX_H * scale) / 2
    val width = BOX_W * scale

    /** A point `distance` along the road (0 near, 1 horizon): its centre, height and size. */
    data class At(val x: Float, val y: Float, val size: Float, val half: Float)

    fun at(distance: Double): At {
      val near = (1 - distance.coerceIn(0.0, 1.0)).pow(DEPTH).toFloat()
      val vanishX = left + width * VANISH_X
      return At(
        x = vanishX + (left + width / 2 - vanishX) * near,
        y = top + (HORIZON_Y + (BOX_H - HORIZON_Y) * near) * scale,
        size = 0.06f + 0.94f * near,
        half = width * HALF_ROAD * near,
      )
    }

    val shapes = mutableListOf<RoadShape>()
    val horizon = at(1.0)
    val edge = at(0.0)
    shapes += RoadShape.Polygon(
      floatArrayOf(horizon.x - 2 * scale, horizon.x + 2 * scale, edge.x + edge.half, edge.x - edge.half),
      floatArrayOf(horizon.y, horizon.y, edge.y, edge.y),
      ASPHALT,
    )

    // The days behind: oldest nearest, the last one just behind the car.
    val days = road.dashes.size
    val stretch = road.carAt - 0.04
    road.dashes.forEachIndexed { index, level ->
      if (level == null) return@forEachIndexed
      val from = at(stretch * (index + 0.2) / days)
      val to = at(stretch * (index + 0.75) / days)
      shapes += RoadShape.Line(from.x, from.y, to.x, to.y, (1 + 6 * from.size) * scale, alpha(CREAM, level))
    }

    road.lampAt?.let { distance ->
      val lamp = at(distance)
      val x = lamp.x + lamp.half * 1.3f
      val height = (8 + 52 * lamp.size) * scale
      shapes += RoadShape.Line(x, lamp.y, x, lamp.y - height, (1 + 2.5f * lamp.size) * scale, POST)
      shapes += RoadShape.Circle(x, lamp.y - height, (1.5f + 4 * lamp.size) * scale, LAMP)
    }

    val car = at(road.carAt)
    val apart = (6 + 16 * car.size) * scale
    val light = (1.2f + 2.2f * car.size) * scale
    shapes += RoadShape.Circle(car.x - apart / 2, car.y - light, light, TAIL)
    shapes += RoadShape.Circle(car.x + apart / 2, car.y - light, light, TAIL)
    return shapes
  }
}
