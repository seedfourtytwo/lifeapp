package expo.modules.lifecore

import android.content.Context
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.datasource.RawResourceDataSource
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The native core's bridge to JavaScript (`src/core/lifeCore.ts`). The
 * running timer lives in [TimerCore]; requests and states cross as JSON text.
 * Every transition, whoever made it, reaches JavaScript as `onStateChange`.
 */
class LifeCoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private var preview: ExoPlayer? = null

  private val onChange: (TimerSession?) -> Unit = { session ->
    sendEvent(EVENT_STATE_CHANGE, mapOf("state" to session?.let(TimerJson::encodeSession)))
  }

  private fun stopPreview() {
    preview?.release()
    preview = null
  }

  override fun definition() = ModuleDefinition {
    Name("LifeCore")

    Events(EVENT_STATE_CHANGE)

    OnCreate { TimerCore.addListener(onChange) }

    OnDestroy {
      TimerCore.removeListener(onChange)
      stopPreview()
    }

    AsyncFunction("start") { requestJson: String ->
      TimerJson.encodeSession(TimerCore.start(context, TimerJson.decodeRequest(requestJson)))
    }

    AsyncFunction("pause") { -> TimerCore.pause(context)?.let(TimerJson::encodeSession) }

    AsyncFunction("resume") { -> TimerCore.resume(context)?.let(TimerJson::encodeSession) }

    AsyncFunction("finish") { markComplete: Boolean ->
      TimerCore.finish(context, markComplete, trackCompleted = false)?.let(TimerJson::encodeRecord)
    }

    AsyncFunction("discard") { -> TimerCore.discard(context) }

    AsyncFunction("getState") { -> TimerCore.state(context)?.let(TimerJson::encodeSession) }

    // The habit editor's preview: the tracks live in this module's resources.
    AsyncFunction("previewSound") { trackId: String ->
      stopPreview()
      val track = HabitSounds.tracks[trackId] ?: return@AsyncFunction false
      preview = ExoPlayer.Builder(context).build().apply {
        setAudioAttributes(
          AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),
          true,
        )
        setMediaItem(MediaItem.fromUri(RawResourceDataSource.buildRawResourceUri(track)))
        prepare()
        play()
      }
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopPreview") { stopPreview() }.runOnQueue(Queues.MAIN)
  }

  private companion object {
    const val EVENT_STATE_CHANGE = "onStateChange"
  }
}
