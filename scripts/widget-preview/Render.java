import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Line2D;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Paints the drawing steps `WidgetPreviewTest` writes into a PNG: Java2D,
 * text in Inter (the phone uses its system font), icons from the widget's
 * own icon font. Usage: java -cp json.jar Render.java steps.json out.png
 */
public class Render {
  private final JSONObject page;
  private final float scale;
  private final Graphics2D g;
  private final BufferedImage image;
  private final Map<String, Font> fonts = new HashMap<>();
  private final Font icons;
  /** How much wider than its minimum the pill on the bottom row came out; what sits left of it moves over. */
  private float pillExtra = 0;

  Render(JSONObject page) throws Exception {
    this.page = page;
    this.scale = (float) page.getDouble("density");
    image = new BufferedImage(Math.round(page.getInt("widthDp") * scale), Math.round(page.getInt("heightDp") * scale), BufferedImage.TYPE_INT_ARGB);
    g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    icons = Font.createFont(Font.TRUETYPE_FONT, new File(page.getString("iconFont")));
  }

  private float px(double dp) {
    return (float) dp * scale;
  }

  private static Color color(String hex) {
    return new Color((int) Long.parseLong(hex.substring(1), 16), true);
  }

  private Color named(String name) {
    return color(page.getJSONObject("colors").getString(name));
  }

  private Font font(String weight, double sizeDp) throws Exception {
    Font base = fonts.get(weight);
    if (base == null) {
      File file = new File("/usr/share/fonts/opentype/inter/Inter-" + weight + ".otf");
      base = file.exists() ? Font.createFont(Font.TRUETYPE_FONT, file) : new Font(Font.SANS_SERIF, Font.PLAIN, 1);
      fonts.put(weight, base);
    }
    return base.deriveFont(px(sizeDp));
  }

  private void glass(java.awt.Shape shape, Rectangle2D bounds, Color ring, float ringPx) {
    g.setPaint(new GradientPaint((float) bounds.getMinX(), (float) bounds.getMinY(), named("glass_top"), (float) bounds.getMaxX(), (float) bounds.getMaxY(), named("glass_bottom")));
    g.fill(shape);
    g.setColor(ring);
    g.setStroke(new BasicStroke(ringPx));
    g.draw(shape);
  }

  private float shift(JSONObject step) {
    return step.optBoolean("afterPill") ? pillExtra : 0;
  }

  private void text(JSONObject step) throws Exception {
    g.setFont(font(step.getString("weight"), step.getDouble("size")));
    g.setColor(color(step.getString("color")));
    FontMetrics metrics = g.getFontMetrics();
    String words = step.getString("text");
    float width = metrics.stringWidth(words);
    float x = px(step.getDouble("x")) - px(shift(step));
    switch (step.getString("align")) {
      case "center" -> x -= width / 2;
      case "end" -> x -= width;
      default -> { }
    }
    g.drawString(words, x, px(step.getDouble("top")) + metrics.getAscent());
  }

  private void icon(int codePoint, float xPx, float topPx, float sizePx) {
    g.setFont(icons.deriveFont(sizePx));
    g.setColor(named("cream"));
    FontMetrics metrics = g.getFontMetrics();
    String glyph = new String(Character.toChars(codePoint));
    g.drawString(glyph, xPx + (sizePx - metrics.stringWidth(glyph)) / 2, topPx + sizePx / 2 - (metrics.getAscent() + metrics.getDescent()) / 2f + metrics.getAscent());
  }

  private void glyph(JSONObject step) {
    float unit = px(step.getDouble("size")) / 24f;
    var saved = g.getTransform();
    g.translate(px(step.getDouble("cx") - shift(step)) - 12 * unit, px(step.getDouble("cy")) - 12 * unit);
    g.scale(unit, unit);
    g.setColor(named("cream"));
    switch (step.getString("kind")) {
      case "play" -> g.fill(path(new float[] {8, 8, 19}, new float[] {5, 19, 12}));
      case "pause" -> {
        g.fill(new Rectangle2D.Float(7, 5, 4, 14));
        g.fill(new Rectangle2D.Float(13, 5, 4, 14));
      }
      case "stop" -> g.fill(new Rectangle2D.Float(7, 7, 10, 10));
      case "check" -> g.fill(path(new float[] {9.2f, 4.9f, 3.3f, 9.2f, 21f, 19.4f}, new float[] {16.6f, 12.3f, 13.9f, 19.8f, 8f, 6.4f}));
      case "tick" -> {
        g.setStroke(new BasicStroke(2f));
        g.draw(new Ellipse2D.Float(5, 5, 14, 14));
      }
      default -> throw new IllegalArgumentException(step.getString("kind"));
    }
    g.setTransform(saved);
  }

  private static Path2D path(float[] xs, float[] ys) {
    Path2D.Float path = new Path2D.Float();
    path.moveTo(xs[0], ys[0]);
    for (int i = 1; i < xs.length; i++) path.lineTo(xs[i], ys[i]);
    path.closePath();
    return path;
  }

  private void shapes(JSONObject step) {
    var saved = g.getTransform();
    g.translate(px(step.getDouble("left")), px(step.getDouble("top")));
    JSONArray shapes = step.getJSONArray("shapes");
    for (int i = 0; i < shapes.length(); i++) {
      JSONObject shape = shapes.getJSONObject(i);
      g.setColor(new Color(shape.getInt("color"), true));
      switch (shape.getString("kind")) {
        case "polygon" -> {
          JSONArray xs = shape.getJSONArray("xs");
          JSONArray ys = shape.getJSONArray("ys");
          float[] x = new float[xs.length()];
          float[] y = new float[ys.length()];
          for (int k = 0; k < x.length; k++) {
            x[k] = (float) xs.getDouble(k);
            y[k] = (float) ys.getDouble(k);
          }
          g.fill(path(x, y));
        }
        case "line" -> {
          g.setStroke(new BasicStroke((float) shape.getDouble("width"), BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER));
          g.draw(new Line2D.Double(shape.getDouble("x1"), shape.getDouble("y1"), shape.getDouble("x2"), shape.getDouble("y2")));
        }
        case "circle" -> {
          double r = shape.getDouble("r");
          g.fill(new Ellipse2D.Double(shape.getDouble("cx") - r, shape.getDouble("cy") - r, 2 * r, 2 * r));
        }
        default -> throw new IllegalArgumentException(shape.getString("kind"));
      }
    }
    g.setTransform(saved);
  }

  void paint() throws Exception {
    // A stand-in for the lock-screen wallpaper: the Night road sky.
    g.setPaint(new GradientPaint(0, 0, new Color(0x0A0A22), 0, image.getHeight(), new Color(0x26245E)));
    g.fillRect(0, 0, image.getWidth(), image.getHeight());
    JSONArray steps = page.getJSONArray("steps");
    for (int i = 0; i < steps.length(); i++) {
      JSONObject step = steps.getJSONObject(i);
      switch (step.getString("op")) {
        case "tile" -> {
          var tile = new RoundRectangle2D.Float(0.5f, 0.5f, image.getWidth() - 1, image.getHeight() - 1, px(56), px(56));
          glass(tile, tile.getBounds2D(), named("hairline"), px(1));
          g.setColor(named("highlight"));
          g.fill(new Rectangle2D.Float(px(28), 0, image.getWidth() - px(56), px(1)));
        }
        case "text" -> text(step);
        case "iconText" -> {
          Font font = font(step.getString("weight"), step.getDouble("size"));
          float textWidth = g.getFontMetrics(font).stringWidth(step.getString("text"));
          boolean hasIcon = !step.isNull("codePoint");
          float iconWidth = hasIcon ? px(step.getDouble("iconSize") + step.getDouble("gap")) : 0;
          float left = px(step.getDouble("cx")) - (iconWidth + textWidth) / 2;
          float top = px(step.getDouble("top"));
          if (hasIcon) icon(step.getInt("codePoint"), left, top + (g.getFontMetrics(font).getHeight() - px(step.getDouble("iconSize"))) / 2, px(step.getDouble("iconSize")));
          g.setFont(font);
          g.setColor(color(step.getString("color")));
          g.drawString(step.getString("text"), left + iconWidth, top + g.getFontMetrics().getAscent());
        }
        case "icon" -> icon(step.getInt("codePoint"), px(step.getDouble("x")), px(step.getDouble("top")), px(step.getDouble("size")));
        case "glyph" -> glyph(step);
        case "shapes" -> shapes(step);
        case "round" -> {
          float x = px(step.getDouble("x") - shift(step));
          float size = px(step.getDouble("size"));
          var circle = new Ellipse2D.Float(x, px(step.getDouble("top")), size, size);
          glass(circle, circle.getBounds2D(), color(step.getString("ring")), px(step.getDouble("ringWidth")));
        }
        case "pill" -> {
          var pill = new RoundRectangle2D.Float(px(step.getDouble("x")), px(step.getDouble("top")), px(step.getDouble("width")), px(step.getDouble("height")), px(step.getDouble("height")), px(step.getDouble("height")));
          glass(pill, pill.getBounds2D(), color(step.getString("ring")), px(step.getDouble("ringWidth")));
        }
        case "pillText" -> {
          Font font = font("Medium", 15);
          String words = step.getString("text");
          float textWidth = g.getFontMetrics(font).stringWidth(words);
          float width = Math.max(px(step.getDouble("minWidth")), textWidth + 2 * px(step.getDouble("padding")));
          pillExtra = (width / scale) - (float) step.getDouble("minWidth");
          float right = px(step.getDouble("right"));
          float top = px(step.getDouble("top"));
          float height = px(step.getDouble("height"));
          var pill = new RoundRectangle2D.Float(right - width, top, width, height, height, height);
          glass(pill, pill.getBounds2D(), color(step.getString("ring")), px(step.getDouble("ringWidth")));
          g.setFont(font);
          g.setColor(named("cream"));
          FontMetrics metrics = g.getFontMetrics();
          g.drawString(words, right - width / 2 - textWidth / 2, top + height / 2 - (metrics.getAscent() + metrics.getDescent()) / 2f + metrics.getAscent());
        }
        case "rrect" -> {
          g.setColor(color(step.getString("color")));
          float h = px(step.getDouble("height"));
          g.fill(new RoundRectangle2D.Float(px(step.getDouble("x")), px(step.getDouble("top")), px(step.getDouble("width")), h, h, h));
        }
        default -> throw new IllegalArgumentException(step.getString("op"));
      }
    }
    g.dispose();
  }

  public static void main(String[] args) throws Exception {
    Render render = new Render(new JSONObject(new String(java.nio.file.Files.readAllBytes(new File(args[0]).toPath()))));
    render.paint();
    ImageIO.write(render.image, "png", new File(args[1]));
  }
}
