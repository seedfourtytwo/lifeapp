# Note dictation — Moonshine Voice overhaul

**Status:** In progress (Aug 2026)  
**Replaces:** sherpa-onnx Nemotron 0.6B via `react-native-sherpa-onnx`  
**North star:** Live text keeps up with speech; Done commits in <1 s; GrapheneOS-local; English v1.

## Why we switched

| Issue (sherpa) | Root cause | Moonshine fix |
|----------------|------------|---------------|
| Live echo seconds behind | 600M model + RN bridge PCM every 80 ms, RTF > 1 | Native `MicTranscriber`, text-only events |
| Never catches up on pause | JS decode queue backlog | Native adaptive `updateInterval` |
| Done takes 10–60+ s | Drain unfed PCM + full-utterance decode in JS | Native `stopStream` flush (~instant) |
| Reopen note looks dead | Draft + orphan italic interim | Unified preview (draft + live tail) |

## Architecture

```
Mic (native) → MicTranscriber → onText / onLine → Expo events → useNoteDictationController → UI
```

**Layers (project-architecture.mdc):**

1. `modules/life-moonshine-dictation/` — TurboModule; mic + model + decode; no PCM in JS
2. `src/dictation/` — constants, ensure model, thin session wrapper, mic permission
3. `src/hooks/useNoteDictationController.ts` — session state machine only
4. `src/components/DayNoteEditorSheet.tsx` — unified preview UI

## Model

- **English Small Streaming** (`MOONSHINE_MODEL_ARCH_SMALL_STREAMING`, 123M, ~7.84% WER avg)
- Fallback candidate: Medium Streaming (245M) if QA accuracy insufficient
- `setUpdateInterval(0.15)` — snappier partials (default 0.5 s)
- Download: Moonshine `MicTranscriber.load()` + `onProgress`; first run Wi‑Fi recommended (copy in i18n)

## Native module API

| Method | Purpose |
|--------|---------|
| `isSupported()` | Android true, else false |
| `prepare()` | Download if needed + load model (background) |
| `warm()` | Load if on disk (sheet preload) |
| `start()` | Reset session buffer, start mic |
| `stop()` | Stop mic, flush, return `{ text }` |
| `abort()` | Stop without result |
| `deleteLegacySpeechModels()` | Remove old sherpa dirs |

| Event | Payload |
|-------|---------|
| `onPartial` | `{ text }` — current line in progress |
| `onLine` | `{ text }` — VAD-completed line (buffer only) |
| `onListening` | `{}` |
| `onDownloadProgress` | `{ fraction, file? }` |
| `onError` | `{ message }` |

## UI — unified preview

- **Committed draft** (normal weight) + **live tail** (italic, onSurfaceVariant)
- Same surface for empty note, reopen-to-append, quick capture
- Finishing state only if `stop()` > 300 ms

## Cleanup (sherpa)

- Remove `react-native-sherpa-onnx`, `@kesha-antonov/react-native-background-downloader`
- Remove `scripts/pinSherpaOnnxAndroid.mjs`, postinstall hook
- Delete `src/stt/sherpa*.ts`, `sherpaStreamingSession.ts`
- Legacy model dirs removed on first Moonshine prepare

## QA (Pixel 9, GrapheneOS)

1. First mic → download → live partials while speaking
2. Pause → text catches up
3. Done < 1 s → accurate commit
4. Reopen note → draft + growing tail
5. Quick capture autoStart → save on Done
6. Offline after download
7. Rebuild **dev APK** after native module (not Metro-only)
8. **minSdk 26** — required by Moonshine Voice (Android 8+)

## References

- [moonshine-ai/moonshine](https://github.com/moonshine-ai/moonshine) — MIT, `ai.moonshine:moonshine-voice`
- [MicTranscriber API](https://moonshine-voice.readthedocs.io/en/latest/api/classes/#mictranscriber)
- [Android Transcriber example](https://github.com/moonshine-ai/moonshine/tree/main/examples/android/Transcriber)
