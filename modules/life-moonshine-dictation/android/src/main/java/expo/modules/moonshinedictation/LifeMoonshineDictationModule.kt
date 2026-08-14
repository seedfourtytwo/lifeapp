package expo.modules.moonshinedictation

import ai.moonshine.voice.JNI
import ai.moonshine.voice.MicTranscriber
import ai.moonshine.voice.TranscriptLine
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * On-device note dictation via Moonshine Voice.
 * Mic capture + streaming decode stay native — JS receives text events only.
 */
class LifeMoonshineDictationModule : Module() {
  private val worker = Executors.newSingleThreadScheduledExecutor()
  private var mic: MicTranscriber? = null
  private var listening = false

  private val sessionLines = StringBuilder()
  private var currentPartial = ""
  private val stopLatch = AtomicReference<CountDownLatch?>(null)

  private var idleWatchFuture: ScheduledFuture<*>? = null
  private var lastActivityMs = 0L
  private var sessionStartedAtMs = 0L
  private var speechCapturing = false
  private var lastSentDisplay = ""
  private var acceptingSpeech = true
  private var takeLimitEmitted = false

  override fun definition() = ModuleDefinition {
    Name("LifeMoonshineDictation")

    Events(
      EVENT_PARTIAL,
      EVENT_CAPTURING,
      EVENT_LISTENING,
      EVENT_DOWNLOAD_PROGRESS,
      EVENT_TAKE_LIMIT,
      EVENT_ERROR,
    )

    Function("isSupported") {
      true
    }

    AsyncFunction("prepare") { promise: Promise ->
      worker.execute {
        try {
          ensureMic()
          if (!mic!!.isLoaded) {
            mic!!.load()
          }
          promise.resolve(mapOf("ready" to true))
        } catch (error: Throwable) {
          promise.reject("PREPARE_FAILED", error.message ?: "Model prepare failed", error)
        }
      }
    }

    AsyncFunction("warm") { promise: Promise ->
      worker.execute {
        try {
          ensureMic()
          if (!mic!!.isLoaded) {
            mic!!.load()
          }
          promise.resolve(null)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("start") { promise: Promise ->
      worker.execute {
        try {
          if (listening) {
            promise.reject("BUSY", "Dictation already active", null)
            return@execute
          }
          ensureMic()
          if (!mic!!.isLoaded) {
            mic!!.load()
          }
          resetSessionBuffers()
          resetCaptureState()
          sessionStartedAtMs = System.currentTimeMillis()
          mic!!.setUpdateInterval(IDLE_UPDATE_INTERVAL_SECONDS)
          mic!!.start()
          listening = true
          scheduleIdleWatch()
          sendEvent(EVENT_LISTENING, Bundle.EMPTY)
          emitCapturing(false)
          promise.resolve(null)
        } catch (error: Throwable) {
          listening = false
          cancelIdleWatch()
          resetSessionBuffers()
          resetCaptureState()
          promise.reject("START_FAILED", error.message ?: "Start failed", error)
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      worker.execute {
        try {
          val text = stopAndCollectText()
          promise.resolve(mapOf("text" to text))
        } catch (error: Throwable) {
          promise.reject("STOP_FAILED", error.message ?: "Stop failed", error)
        }
      }
    }

    AsyncFunction("abort") { promise: Promise ->
      worker.execute {
        try {
          cancelIdleWatch()
          if (listening) {
            mic?.stop()
          }
          listening = false
          resetSessionBuffers()
          resetCaptureState()
          stopLatch.getAndSet(null)?.countDown()
          promise.resolve(null)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("deleteLegacySpeechModels") { promise: Promise ->
      worker.execute {
        try {
          val ctx = appContext.reactContext?.applicationContext ?: run {
            promise.resolve(null)
            return@execute
          }
          deleteLegacySherpaTrees(ctx.filesDir, ctx.cacheDir)
          promise.resolve(null)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    OnDestroy {
      try {
        cancelIdleWatch()
        if (listening) {
          mic?.stop()
        }
        listening = false
        stopLatch.getAndSet(null)?.countDown()
        mic?.close()
      } catch (_: Throwable) {
        // ignore
      }
      mic = null
      worker.shutdownNow()
    }
  }

  private fun ensureMic() {
    if (mic != null) return
    val context = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React context unavailable")
    mic = MicTranscriber(context)
      .language("en")
      .modelArch(JNI.MOONSHINE_MODEL_ARCH_SMALL_STREAMING)
      .onProgress { fraction, file ->
        sendEvent(
          EVENT_DOWNLOAD_PROGRESS,
          Bundle().apply {
            putDouble("fraction", fraction.toDouble())
            if (file != null) putString("file", file)
          },
        )
      }
      .onText { text ->
        if (!acceptingSpeech) return@onText
        currentPartial = text?.trim().orEmpty()
        emitDisplayIfChanged()
        if (stopLatch.get() != null && currentPartial.isNotEmpty()) {
          stopLatch.get()?.countDown()
        }
        if (sessionCharCount() >= MAX_SESSION_CHARS) {
          stopAccepting("characters")
        }
      }
      .onLine { line: TranscriptLine ->
        if (!acceptingSpeech) return@onLine
        val lineText = line.text?.trim().orEmpty()
        if (lineText.isNotEmpty()) {
          if (sessionLines.isNotEmpty()) sessionLines.append(' ')
          sessionLines.append(lineText)
          currentPartial = ""
          emitDisplayIfChanged()
          stopLatch.get()?.countDown()
          if (sessionCharCount() >= MAX_SESSION_CHARS) {
            stopAccepting("characters")
          }
        }
      }
      .onError { error ->
        sendEvent(
          EVENT_ERROR,
          Bundle().apply {
            putString("message", error.message ?: error.toString())
          },
        )
      }
      .callbacksOnMainThread(false)
      .also { it.setUpdateInterval(IDLE_UPDATE_INTERVAL_SECONDS) }
  }

  private fun emitDisplayIfChanged() {
    val committed = sessionLines.toString().trim()
    val tail = currentPartial.trim()
    val fingerprint = "$committed\u0000$tail"
    if (fingerprint == lastSentDisplay) return
    lastSentDisplay = fingerprint
    if (committed.isNotEmpty() || tail.isNotEmpty()) {
      markSpeechActivity()
    }
    sendEvent(
      EVENT_PARTIAL,
      Bundle().apply {
        putString("committed", committed)
        putString("tail", tail)
      },
    )
  }

  private fun sessionCharCount(): Int {
    val extra = if (sessionLines.isNotEmpty() && currentPartial.isNotEmpty()) 1 else 0
    return sessionLines.length + currentPartial.length + extra
  }

  private fun stopAccepting(reason: String) {
    if (!acceptingSpeech && takeLimitEmitted) return
    acceptingSpeech = false
    emitTakeLimit(reason)
  }

  private fun emitTakeLimit(reason: String) {
    if (takeLimitEmitted) return
    takeLimitEmitted = true
    sendEvent(
      EVENT_TAKE_LIMIT,
      Bundle().apply { putString("reason", reason) },
    )
  }

  private fun checkDurationLimit() {
    if (!listening || takeLimitEmitted || sessionStartedAtMs == 0L) return
    if (System.currentTimeMillis() - sessionStartedAtMs >= MAX_SESSION_MS) {
      stopAccepting("duration")
    }
  }

  private fun markSpeechActivity() {
    lastActivityMs = System.currentTimeMillis()
    if (!speechCapturing) {
      speechCapturing = true
      mic?.setUpdateInterval(SPEECH_UPDATE_INTERVAL_SECONDS)
      emitCapturing(true)
    }
  }

  private fun enterIdleMode() {
    if (!speechCapturing) return
    speechCapturing = false
    mic?.setUpdateInterval(IDLE_UPDATE_INTERVAL_SECONDS)
    emitCapturing(false)
  }

  private fun emitCapturing(active: Boolean) {
    sendEvent(
      EVENT_CAPTURING,
      Bundle().apply { putBoolean("capturing", active) },
    )
  }

  private fun scheduleIdleWatch() {
    cancelIdleWatch()
    lastActivityMs = System.currentTimeMillis()
    idleWatchFuture = worker.scheduleWithFixedDelay(
      {
        if (!listening) return@scheduleWithFixedDelay
        val idleMs = System.currentTimeMillis() - lastActivityMs
        checkDurationLimit()
        if (idleMs >= IDLE_THRESHOLD_MS) {
          enterIdleMode()
        }
      },
      IDLE_POLL_MS,
      IDLE_POLL_MS,
      TimeUnit.MILLISECONDS,
    )
  }

  private fun cancelIdleWatch() {
    idleWatchFuture?.cancel(false)
    idleWatchFuture = null
  }

  private fun resetCaptureState() {
    lastActivityMs = 0L
    sessionStartedAtMs = 0L
    speechCapturing = false
    lastSentDisplay = ""
    acceptingSpeech = true
    takeLimitEmitted = false
  }

  private fun stopAndCollectText(): String {
    cancelIdleWatch()
    if (!listening) {
      val stale = buildSessionText()
      resetSessionBuffers()
      resetCaptureState()
      return stale
    }
    val waitForFlush = speechCapturing
    mic?.setUpdateInterval(SPEECH_UPDATE_INTERVAL_SECONDS)
    if (waitForFlush) {
      val latch = CountDownLatch(1)
      stopLatch.set(latch)
      mic?.stop()
      listening = false
      latch.await(STOP_FLUSH_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      stopLatch.set(null)
    } else {
      mic?.stop()
      listening = false
    }
    val text = buildSessionText()
    resetSessionBuffers()
    resetCaptureState()
    return text
  }

  private fun buildSessionText(): String {
    val lines = sessionLines.toString().trim()
    val partial = currentPartial.trim()
    return when {
      lines.isEmpty() -> partial
      partial.isEmpty() -> lines
      else -> "$lines $partial"
    }.trim()
  }

  private fun resetSessionBuffers() {
    sessionLines.clear()
    currentPartial = ""
  }

  /** Sherpa-onnx stored under `sherpa-onnx/` — never touch `moonshine-models/`. */
  private fun deleteLegacySherpaTrees(filesDir: File, cacheDir: File) {
    for (root in listOf(File(filesDir, "sherpa-onnx"), File(cacheDir, "sherpa-onnx"))) {
      if (root.exists()) {
        root.deleteRecursively()
      }
    }
    val legacyModels = File(filesDir, "models")
    val children = legacyModels.listFiles() ?: return
    for (child in children) {
      if (!child.isDirectory) continue
      val name = child.name
      if (LEGACY_SHERPA_MARKERS.any { marker -> name.contains(marker) }) {
        child.deleteRecursively()
      }
    }
    if (legacyModels.isDirectory && legacyModels.listFiles()?.isEmpty() == true) {
      legacyModels.delete()
    }
  }

  companion object {
    private const val EVENT_PARTIAL = "onPartial"
    private const val EVENT_CAPTURING = "onCapturing"
    private const val EVENT_LISTENING = "onListening"
    private const val EVENT_DOWNLOAD_PROGRESS = "onDownloadProgress"
    private const val EVENT_TAKE_LIMIT = "onTakeLimit"
    private const val EVENT_ERROR = "onError"

    /**
     * One take cap — keep in sync with `src/dictation/limits.ts`.
     * No audio is stored; this bounds the live transcript buffer.
     */
    private const val MAX_SESSION_CHARS = 24_000
    private const val MAX_SESSION_MS = 15 * 60 * 1000L

    /** Fast passes while the user is actively speaking. */
    private const val SPEECH_UPDATE_INTERVAL_SECONDS = 0.1

    /** Slower passes during long pauses — mic stays open, less CPU. */
    private const val IDLE_UPDATE_INTERVAL_SECONDS = 0.45

    /** No partial activity this long → treat as idle (Apple-like pause). */
    private const val IDLE_THRESHOLD_MS = 700L

    private const val IDLE_POLL_MS = 200L

    /** Wait for trailing flush after mic.stop(). */
    private const val STOP_FLUSH_TIMEOUT_MS = 2500L

    private val LEGACY_SHERPA_MARKERS = listOf(
      "sherpa-onnx-nemotron",
      "sherpa-onnx-nemo-parakeet",
      "sherpa-onnx-streaming-zipformer",
    )
  }
}
