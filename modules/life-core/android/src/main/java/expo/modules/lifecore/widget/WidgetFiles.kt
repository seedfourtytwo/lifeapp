package expo.modules.lifecore.widget

import android.content.Context
import expo.modules.lifecore.OsQueueFiles
import expo.modules.lifecore.PendingActionsQueue
import java.io.File
import java.io.IOException

/**
 * The widget's files in `files/widget/` (`docs/widget-contract.md`): it
 * reads the snapshot and both queue files, and appends its taps.
 */
class WidgetFiles(context: Context) {
  private val dir = File(context.filesDir, "widget")

  private fun read(name: String): String? = try {
    File(dir, name).takeIf(File::exists)?.readText()
  } catch (_: IOException) {
    null
  }

  fun snapshot(): Snapshot? = read("snapshot.json")?.let(SnapshotJson::parse)

  /**
   * The lines JavaScript has not applied: the draining file (a drain under
   * way), the queue, and the lines this process appended lately, which
   * cover the moment between a drain deleting its file and the new snapshot.
   */
  fun queued(): List<QueuedAction> =
    listOf(DRAINING, QUEUE).flatMap { read(it)?.let(QueueLines::parse).orEmpty() } + QueueMemory.lines()

  fun append(action: QueuedAction) {
    PendingActionsQueue(OsQueueFiles(File(dir, QUEUE))).append(QueueLines.encode(action))
    QueueMemory.remember(action)
  }

  private companion object {
    const val QUEUE = "pending-actions.jsonl"
    const val DRAINING = "pending-actions.draining.jsonl"
  }
}

/** The last lines this process appended, newest last; a few is plenty, as a snapshot follows each drain. */
object QueueMemory {
  private const val KEEP = 32
  private val recent = ArrayDeque<QueuedAction>()

  @Synchronized
  fun remember(action: QueuedAction) {
    recent.addLast(action)
    while (recent.size > KEEP) recent.removeFirst()
  }

  @Synchronized
  fun lines(): List<QueuedAction> = recent.toList()
}
