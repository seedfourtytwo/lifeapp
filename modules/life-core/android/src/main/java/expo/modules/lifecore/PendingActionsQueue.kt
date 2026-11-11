package expo.modules.lifecore

import java.io.IOException

/** One open of the queue file for appending. */
interface QueueHandle {
  fun write(bytes: ByteArray)
  /** The inode of the open file (`fstat`). */
  fun inode(): Long
  fun close()
}

/** The queue file as the append steps need it. */
interface QueueFiles {
  /** Opens `pending-actions.jsonl` with O_WRONLY | O_CREAT | O_APPEND, mode 0600. */
  fun openAppend(): QueueHandle
  /** The inode the path names now (`stat`), or null when it names nothing. */
  fun pathInode(): Long?
}

/**
 * Appends lines to `files/widget/pending-actions.jsonl` exactly as
 * `docs/widget-contract.md` says: open for this one line, write it whole,
 * compare the open file's inode with the path's, close; if JavaScript
 * renamed the queue meanwhile, write the same line again. A line that lands
 * twice carries the same id and is applied once.
 */
class PendingActionsQueue(private val files: QueueFiles) {
  fun append(line: String) {
    require('\n' !in line) { "A queue line holds no newline" }
    val bytes = "$line\n".toByteArray(Charsets.UTF_8)
    require(bytes.size <= MAX_LINE_BYTES) { "A queue line is at most $MAX_LINE_BYTES bytes" }

    repeat(MAX_ATTEMPTS) {
      val handle = files.openAppend()
      val landed = try {
        handle.write(bytes)
        handle.inode() == files.pathInode()
      } finally {
        handle.close()
      }
      if (landed) return
    }
    // The drain renames once per pass; this many in a row means something else is wrong.
    throw IOException("The queue kept moving while a line was appended")
  }

  companion object {
    const val MAX_LINE_BYTES = 1024
    const val MAX_ATTEMPTS = 8
  }
}
