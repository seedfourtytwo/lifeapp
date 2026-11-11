package expo.modules.lifecore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/** The append steps of `docs/widget-contract.md`, against files whose inodes the test controls. */
class PendingActionsQueueTest {
  /**
   * A directory where `pending-actions.jsonl` is a name pointing at a file
   * with an inode number; `rename` moves that file away, as the drain does.
   */
  private class FakeFiles : QueueFiles {
    val files = mutableMapOf<Long, StringBuilder>()
    var current: Long? = null
    private var nextInode = 1L
    var opens = 0
    var closes = 0
    /** Runs after the write of the given open, before its stat: the drain's rename. */
    var duringOpen: Map<Int, () -> Unit> = emptyMap()

    fun rename() {
      current = null
    }

    fun text(inode: Long) = files.getValue(inode).toString()

    override fun openAppend(): QueueHandle {
      opens += 1
      val inode = current ?: nextInode++.also {
        files[it] = StringBuilder()
        current = it
      }
      val open = opens
      return object : QueueHandle {
        override fun write(bytes: ByteArray) {
          files.getValue(inode).append(String(bytes, Charsets.UTF_8))
          duringOpen[open]?.invoke()
        }

        override fun inode() = inode

        override fun close() {
          closes += 1
        }
      }
    }

    override fun pathInode(): Long? = current
  }

  private val line = """{"v":1,"id":"6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11","type":"timer_session"}"""

  @Test
  fun appendsOneLineEndingInANewlineAndClosesTheFile() {
    val files = FakeFiles()
    PendingActionsQueue(files).append(line)
    assertEquals("$line\n", files.text(1))
    assertEquals(1, files.opens)
    assertEquals(1, files.closes)
  }

  @Test
  fun addsToWhatIsAlreadyQueued() {
    val files = FakeFiles()
    val queue = PendingActionsQueue(files)
    queue.append(line)
    queue.append(line.replace("timer_session", "counter_add"))
    assertEquals(2, files.text(1).count { it == '\n' })
  }

  @Test
  fun writesTheSameLineAgainWhenTheQueueWasRenamedMidWrite() {
    val files = FakeFiles()
    files.duringOpen = mapOf(1 to files::rename)

    PendingActionsQueue(files).append(line)

    assertEquals("$line\n", files.text(1))
    assertEquals("$line\n", files.text(2))
    assertEquals(2, files.opens)
    assertEquals(2, files.closes)
  }

  @Test
  fun writesAgainWhenTheQueueIsGoneBeforeTheStat() {
    val files = FakeFiles()
    var renames = 0
    files.duringOpen = mapOf(1 to { files.rename(); renames += 1 })
    PendingActionsQueue(files).append(line)
    assertEquals(1, renames)
    assertTrue(files.files.values.all { it.toString() == "$line\n" })
  }

  @Test
  fun givesUpRatherThanLoopingForever() {
    val files = FakeFiles()
    files.duringOpen = (1..PendingActionsQueue.MAX_ATTEMPTS).associateWith { { files.rename() } }
    assertThrows(IOException::class.java) { PendingActionsQueue(files).append(line) }
  }

  @Test
  fun refusesALineThatWouldBreakTheFormat() {
    val queue = PendingActionsQueue(FakeFiles())
    assertThrows(IllegalArgumentException::class.java) { queue.append("{\"a\":1}\n{\"b\":2}") }
    assertThrows(IllegalArgumentException::class.java) { queue.append("x".repeat(1024)) }
  }
}
