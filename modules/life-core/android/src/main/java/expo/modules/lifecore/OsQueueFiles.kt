package expo.modules.lifecore

import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import java.io.File

/** The queue's file calls on the phone: `Os.open`, `Os.write`, `Os.fstat`, `Os.stat`. */
class OsQueueFiles(private val file: File) : QueueFiles {
  override fun openAppend(): QueueHandle {
    file.parentFile?.mkdirs()
    val fd = Os.open(file.path, OsConstants.O_WRONLY or OsConstants.O_CREAT or OsConstants.O_APPEND, OWNER_READ_WRITE)
    return object : QueueHandle {
      override fun write(bytes: ByteArray) {
        // One call for a line under 1 KB on a regular file; the loop only
        // guards against a short write, which continues the same line.
        var offset = 0
        while (offset < bytes.size) offset += Os.write(fd, bytes, offset, bytes.size - offset)
      }

      override fun inode(): Long = Os.fstat(fd).st_ino

      override fun close() = Os.close(fd)
    }
  }

  override fun pathInode(): Long? = try {
    Os.stat(file.path).st_ino
  } catch (_: ErrnoException) {
    null
  }

  private companion object {
    /** 0600. */
    const val OWNER_READ_WRITE = 384
  }
}
