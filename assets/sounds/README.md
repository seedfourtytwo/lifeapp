# Bundled habit timer sounds

Use **96 kbps** MP3s here — good quality for voice/guided audio and much faster to load on device.

Register each track in:

1. `src/protocol/habitSoundCatalog.ts` — id + label shown in the habit editor
2. `src/audio/bundledHabitSoundAssets.native.ts` — `require()` for the file

Example:

1. Add `assets/sounds/morning-calm.mp3`
2. Catalog: `{ id: 'morning-calm', label: 'Morning calm' }`
3. Assets: `'morning-calm': require('../../assets/sounds/morning-calm.mp3')`
4. Rebuild the dev client APK (sounds ship inside the app)

Current tracks: `meditation15min`, `meditation30min`, `wimhofMorning`, `wimhofEvening`.

Internal (not in catalog): `timerKeepalive.mp3` — muted 2s loop used so timers without a habit sound still own the OS media session / lock-screen controls.

Completion feedback: `habitComplete.wav` — soft ~2.4s singing-bowl style chime (bundled; reload Metro to pick up asset changes).
