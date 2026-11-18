package expo.modules.lifewidget

/**
 * A minimal JSON reader for the small documents this widget reads: element
 * `config_json`, event `meta_json`, and the shared test fixture.
 *
 * Pure Kotlin on purpose (no org.json): org.json is an Android framework class,
 * stubbed out in local JVM unit tests, and TodayRules must be testable there.
 *
 * Objects become Map<String, Any?>, arrays List<Any?>, numbers Double,
 * plus String, Boolean and null.
 */
object MiniJson {
  class ParseException(message: String) : RuntimeException(message)

  fun parse(text: String): Any? {
    val reader = Reader(text)
    reader.skipWhitespace()
    val value = reader.readValue()
    reader.skipWhitespace()
    if (!reader.atEnd()) throw ParseException("Trailing characters at ${reader.pos}")
    return value
  }

  /** Parses text expected to be a JSON object; null when it is not one or does not parse. */
  fun parseObjectOrNull(text: String?): Map<String, Any?>? {
    if (text.isNullOrBlank()) return null
    return try {
      @Suppress("UNCHECKED_CAST")
      parse(text) as? Map<String, Any?>
    } catch (e: ParseException) {
      null
    } catch (e: NumberFormatException) {
      null
    }
  }

  private class Reader(private val s: String) {
    var pos = 0

    fun atEnd(): Boolean = pos >= s.length

    fun skipWhitespace() {
      while (pos < s.length && (s[pos] == ' ' || s[pos] == '\n' || s[pos] == '\r' || s[pos] == '\t')) {
        pos++
      }
    }

    private fun peek(): Char {
      if (pos >= s.length) throw ParseException("Unexpected end of input")
      return s[pos]
    }

    private fun expectWord(word: String) {
      if (!s.startsWith(word, pos)) throw ParseException("Expected $word at $pos")
      pos += word.length
    }

    fun readValue(): Any? {
      skipWhitespace()
      return when (val c = peek()) {
        '{' -> readObject()
        '[' -> readArray()
        '"' -> readString()
        't' -> { expectWord("true"); true }
        'f' -> { expectWord("false"); false }
        'n' -> { expectWord("null"); null }
        else -> {
          if (c == '-' || (c in '0'..'9')) readNumber() else throw ParseException("Unexpected '$c' at $pos")
        }
      }
    }

    private fun readObject(): Map<String, Any?> {
      val result = LinkedHashMap<String, Any?>()
      pos++ // {
      skipWhitespace()
      if (peek() == '}') {
        pos++
        return result
      }
      while (true) {
        skipWhitespace()
        if (peek() != '"') throw ParseException("Expected key at $pos")
        val key = readString()
        skipWhitespace()
        if (peek() != ':') throw ParseException("Expected ':' at $pos")
        pos++
        result[key] = readValue()
        skipWhitespace()
        when (peek()) {
          ',' -> pos++
          '}' -> {
            pos++
            return result
          }
          else -> throw ParseException("Expected ',' or '}' at $pos")
        }
      }
    }

    private fun readArray(): List<Any?> {
      val result = ArrayList<Any?>()
      pos++ // [
      skipWhitespace()
      if (peek() == ']') {
        pos++
        return result
      }
      while (true) {
        result.add(readValue())
        skipWhitespace()
        when (peek()) {
          ',' -> pos++
          ']' -> {
            pos++
            return result
          }
          else -> throw ParseException("Expected ',' or ']' at $pos")
        }
      }
    }

    private fun readString(): String {
      pos++ // opening quote
      val out = StringBuilder()
      while (true) {
        val c = peek()
        pos++
        when (c) {
          '"' -> return out.toString()
          '\\' -> {
            val e = peek()
            pos++
            when (e) {
              '"' -> out.append('"')
              '\\' -> out.append('\\')
              '/' -> out.append('/')
              'b' -> out.append('\b')
              'f' -> out.append('\u000C')
              'n' -> out.append('\n')
              'r' -> out.append('\r')
              't' -> out.append('\t')
              'u' -> {
                if (pos + 4 > s.length) throw ParseException("Bad unicode escape at $pos")
                val hex = s.substring(pos, pos + 4)
                out.append(hex.toInt(16).toChar())
                pos += 4
              }
              else -> throw ParseException("Bad escape at $pos")
            }
          }
          else -> out.append(c)
        }
      }
    }

    private fun readNumber(): Double {
      val start = pos
      if (s[pos] == '-') pos++
      while (pos < s.length) {
        val c = s[pos]
        if ((c in '0'..'9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') {
          pos++
        } else {
          break
        }
      }
      return s.substring(start, pos).toDouble()
    }
  }
}
