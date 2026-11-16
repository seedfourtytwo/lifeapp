package expo.modules.lifewidget

import android.app.Application
import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.os.Build
import android.util.Log
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

sealed class WidgetSnapshot {
  /** No database file yet, or not one the app has set up: "Open Life to get started". */
  object NoDatabase : WidgetSnapshot()

  data class Ready(
    val today: LocalDate,
    val model: TodayModel,
    /** Next minute today at which a habit's visibility window opens or closes. */
    val nextBoundaryMinute: Int?,
  ) : WidgetSnapshot()
}

/**
 * The widget's only door into the app's SQLite file.
 *
 * WHY THIS RUNS ONLY IN THE ":widget" PROCESS: the app's JS side opens this file
 * through expo-sqlite, which bundles its own copy of the SQLite library. SQLite
 * keeps POSIX advisory locks per process, and two different SQLite copies inside
 * one process do not know about each other's locks — closing the file in one
 * silently drops the other's locks, which can corrupt the database. Opening it
 * here with android.database.sqlite from the main process would be exactly that.
 * In a separate OS process the kernel keeps the locks apart, and cross-process
 * access through WAL + file locks is what SQLite is built for. Every component
 * that calls into this object is declared android:process=":widget" in the
 * module's AndroidManifest.xml.
 *
 * Never creates the file and never runs DDL: the app owns the schema.
 */
object WidgetDb {
  private const val TAG = "LifeWidget"

  /** expo-sqlite's default directory (`filesDir/SQLite`) + DB_NAME from src/db/schema.ts. */
  private const val DB_RELATIVE_PATH = "SQLite/lifeapp.db"

  /** Same as DB_BUSY_TIMEOUT_MS in src/db/client.ts. */
  private const val BUSY_TIMEOUT_MS = 4000

  private const val WIDGET_PROCESS_SUFFIX = ":widget"

  private fun isWidgetProcess(): Boolean {
    // Application.getProcessName() exists from API 28; below that we rely on the manifest alone.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return true
    return Application.getProcessName().endsWith(WIDGET_PROCESS_SUFFIX)
  }

  private fun <T> withDb(context: Context, block: (SQLiteDatabase) -> T): T? {
    if (!isWidgetProcess()) {
      Log.e(TAG, "Refusing to open the database outside the :widget process")
      return null
    }
    val file = File(context.filesDir, DB_RELATIVE_PATH)
    if (!file.isFile) return null

    val db: SQLiteDatabase
    try {
      // NO_LOCALIZED_COLLATORS: otherwise the framework creates an
      // android_metadata table in the app's database on open.
      // ENABLE_WRITE_AHEAD_LOGGING: the file is already WAL (set by the app);
      // without this flag the framework would try to set its default journal mode.
      db = SQLiteDatabase.openDatabase(
        file.path,
        null,
        SQLiteDatabase.OPEN_READWRITE or
          SQLiteDatabase.NO_LOCALIZED_COLLATORS or
          SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
      )
    } catch (e: SQLiteException) {
      Log.w(TAG, "Could not open database", e)
      return null
    }

    try {
      // PRAGMA busy_timeout returns a row, so rawQuery rather than execSQL.
      db.rawQuery("PRAGMA busy_timeout = $BUSY_TIMEOUT_MS", null).use { it.moveToFirst() }
      if (!hasTable(db, "elements") || !hasTable(db, "events") || !hasTable(db, "dashboard_items")) {
        return null
      }
      return block(db)
    } catch (e: SQLiteException) {
      Log.w(TAG, "Database access failed", e)
      return null
    } finally {
      db.close()
    }
  }

  private fun hasTable(db: SQLiteDatabase, name: String): Boolean =
    db.rawQuery(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
      arrayOf(name),
    ).use { it.moveToFirst() }

  // ---- reads -------------------------------------------------------------

  private class ElementRow(val id: String, val kind: String, val name: String, val config: Map<String, Any?>)

  fun loadSnapshot(context: Context): WidgetSnapshot {
    val today = LocalDate.now()
    val time = LocalTime.now()
    val minuteOfDay = time.hour * 60 + time.minute
    return withDb(context) { db -> readSnapshot(db, today, minuteOfDay) } ?: WidgetSnapshot.NoDatabase
  }

  private fun readSnapshot(db: SQLiteDatabase, today: LocalDate, minuteOfDay: Int): WidgetSnapshot {
    val ordered = ArrayList<OrderableElement<ElementRow>>()
    db.rawQuery(
      """
      SELECT e.id, e.kind, e.name, e.config_json, e.created_at, d.sort_order
      FROM elements e
      LEFT JOIN dashboard_items d ON d.element_id = e.id
      WHERE e.archived_at IS NULL AND e.kind IN ('habit', 'counter')
      """.trimIndent(),
      null,
    ).use { c ->
      while (c.moveToNext()) {
        val config = MiniJson.parseObjectOrNull(c.getString(3))
        if (config != null) {
          ordered.add(
            OrderableElement(
              value = ElementRow(c.getString(0), c.getString(1), c.getString(2), config),
              createdAt = c.getString(4) ?: "",
              sortOrder = if (c.isNull(5)) null else c.getLong(5),
            ),
          )
        }
      }
    }
    val elements = TodayRules.sortByDashboard(ordered)

    val habits = ArrayList<HabitInput>()
    val counterDefs = ArrayList<Pair<ElementRow, CounterRules>>()
    for (element in elements) {
      when (element.kind) {
        "habit" -> TodayRules.parseHabitConfig(element.config)?.let {
          habits.add(HabitInput(element.id, element.name, it))
        }
        "counter" -> TodayRules.parseCounterConfig(element.config)?.let {
          counterDefs.add(element to it)
        }
      }
    }

    val facts = readFacts(db, TodayRules.weekStart(today).toString(), today.toString())
    val todayKey = today.toString()
    val counters = counterDefs.map { (element, rules) ->
      CounterInput(element.id, element.name, rules, facts["${element.id}|$todayKey"]?.total ?: 0.0)
    }

    val todos = ArrayList<TodoInput>()
    if (hasTable(db, "todos")) {
      db.rawQuery(
        "SELECT id, title, due_date, sort_order FROM todos WHERE completed_at IS NULL",
        null,
      ).use { c ->
        while (c.moveToNext()) {
          todos.add(
            TodoInput(
              id = c.getString(0),
              title = c.getString(1) ?: "",
              dueDate = if (c.isNull(2)) null else c.getString(2),
              sortOrder = c.getLong(3),
            ),
          )
        }
      }
    }

    val model = TodayRules.buildToday(
      habits = habits,
      habitFacts = { id, date -> facts["$id|$date"] ?: DayFacts.EMPTY },
      counters = counters,
      todos = todos,
      today = today,
      minuteOfDay = minuteOfDay,
    )
    return WidgetSnapshot.Ready(today, model, TodayRules.nextWindowBoundary(habits, minuteOfDay))
  }

  /** Day facts keyed "elementId|YYYY-MM-DD" for dates in [from, to]. */
  private fun readFacts(db: SQLiteDatabase, from: String, to: String): Map<String, DayFacts> {
    val result = HashMap<String, DayFacts>()
    db.rawQuery(
      "SELECT element_id, date, value, meta_json FROM events WHERE date >= ? AND date <= ?",
      arrayOf(from, to),
    ).use { c ->
      while (c.moveToNext()) {
        val key = "${c.getString(0)}|${c.getString(1)}"
        val meta = MiniJson.parseObjectOrNull(if (c.isNull(3)) null else c.getString(3))
        result[key] = addRow(result[key] ?: DayFacts.EMPTY, c.getDouble(2), meta)
      }
    }
    return result
  }

  private fun addRow(facts: DayFacts, value: Double, meta: Map<String, Any?>?): DayFacts {
    val source = meta?.get("source")
    return DayFacts(
      total = facts.total + value,
      hasSkip = facts.hasSkip || source == TodayRules.SKIP_SOURCE,
      trackCompleted = facts.trackCompleted ||
        (source == TodayRules.TIMER_SESSION_SOURCE && meta?.get("trackCompleted") == true),
    )
  }

  private class DayRows(val facts: DayFacts, val skipIds: List<String>)

  private fun readDay(db: SQLiteDatabase, elementId: String, date: String): DayRows {
    var facts = DayFacts.EMPTY
    val skipIds = ArrayList<String>()
    db.rawQuery(
      "SELECT id, value, meta_json FROM events WHERE element_id = ? AND date = ?",
      arrayOf(elementId, date),
    ).use { c ->
      while (c.moveToNext()) {
        val meta = MiniJson.parseObjectOrNull(if (c.isNull(2)) null else c.getString(2))
        if (meta?.get("source") == TodayRules.SKIP_SOURCE) skipIds.add(c.getString(0))
        facts = addRow(facts, c.getDouble(1), meta)
      }
    }
    return DayRows(facts, skipIds)
  }

  /** Config of an active element of `kind`, or null. */
  private fun activeConfig(db: SQLiteDatabase, elementId: String, kind: String): Map<String, Any?>? =
    db.rawQuery(
      "SELECT config_json FROM elements WHERE id = ? AND kind = ? AND archived_at IS NULL",
      arrayOf(elementId, kind),
    ).use { c -> if (c.moveToFirst()) MiniJson.parseObjectOrNull(c.getString(0)) else null }

  // ---- writes ------------------------------------------------------------

  private inline fun <T> inImmediateTransaction(db: SQLiteDatabase, block: () -> T): T {
    // BEGIN IMMEDIATE: take the write lock before reading, like withImmediateTransaction.
    db.beginTransactionNonExclusive()
    try {
      val result = block()
      db.setTransactionSuccessful()
      return result
    } finally {
      db.endTransaction()
    }
  }

  private fun insertEvent(db: SQLiteDatabase, elementId: String, date: String, value: Double, metaJson: String) {
    val values = ContentValues()
    values.put("id", UUID.randomUUID().toString())
    values.put("element_id", elementId)
    values.put("timestamp", TodayRules.isoTimestamp(Instant.now()))
    values.put("date", date)
    values.put("value", value)
    values.put("meta_json", metaJson)
    values.put("protocol_version", TodayRules.PROTOCOL_VERSION)
    db.insertOrThrow("events", null, values)
  }

  /**
   * `applyHabitDayIntent` (src/db/repositories/eventRepository.ts) for a boolean
   * habit: make today's day match `wantDone`, re-reading it inside the write
   * transaction. Done on a skipped day also removes the skip rows; not done
   * removes every row of the day, skip rows included.
   */
  fun applyHabitIntent(context: Context, elementId: String, shownDate: String, wantDone: Boolean) {
    withDb(context) { db ->
      val today = LocalDate.now().toString()
      // The row was drawn for another day (stale across midnight): refresh only.
      if (today != shownDate) return@withDb
      inImmediateTransaction(db) {
        val config = activeConfig(db, elementId, "habit") ?: return@inImmediateTransaction
        val rules = TodayRules.parseHabitConfig(config) ?: return@inImmediateTransaction
        if (rules.timer) return@inImmediateTransaction
        val day = readDay(db, elementId, today)
        val isDone = TodayRules.isHabitDayComplete(rules, day.facts)
        if (isDone == wantDone) return@inImmediateTransaction
        if (!wantDone) {
          db.delete("events", "element_id = ? AND date = ?", arrayOf(elementId, today))
        } else {
          insertEvent(db, elementId, today, 1.0, TodayRules.HABIT_TICK_META_JSON)
          for (id in day.skipIds) {
            db.delete("events", "id = ?", arrayOf(id))
          }
        }
      }
    }
  }

  /** The app's quick-button increment (eventStore.logEvent): one appended event. */
  fun incrementCounter(context: Context, elementId: String, shownDate: String, increment: Double) {
    if (increment <= 0.0 || increment.isNaN() || increment.isInfinite()) return
    withDb(context) { db ->
      val today = LocalDate.now().toString()
      if (today != shownDate) return@withDb
      inImmediateTransaction(db) {
        if (activeConfig(db, elementId, "counter") == null) return@inImmediateTransaction
        insertEvent(db, elementId, today, increment, TodayRules.counterMetaJson(increment))
      }
    }
  }

  /** `setTodoCompleted(db, id, new Date().toISOString())`: only completed_at changes; the row is kept. */
  fun completeTodo(context: Context, todoId: String) {
    withDb(context) { db ->
      if (!hasTable(db, "todos")) return@withDb
      val values = ContentValues()
      values.put("completed_at", TodayRules.isoTimestamp(Instant.now()))
      db.update("todos", values, "id = ? AND completed_at IS NULL", arrayOf(todoId))
      Unit
    }
  }
}
