# Bundled habit timer sounds

Use **96 kbps** MP3s — adequate for guided audio and lighter on device load.

Register each track in:

1. `src/protocol/habitSoundCatalog.ts` — id + label in the habit editor
2. `src/audio/bundledHabitSoundAssets.native.ts` — `require()` for the file

Example:

1. Add `assets/sounds/morning-calm.mp3`
2. Catalog: `{ id: 'morning-calm', label: 'Morning calm' }`
3. Assets: `'morning-calm': require('../../assets/sounds/morning-calm.mp3')`
4. Rebuild the native APK (sounds ship inside the app)

Catalog tracks: `meditation15min`, `meditation30min`, `wimhofMorning`, `wimhofEvening`.

Internal (not in catalog): `timerKeepalive.mp3` — short muted loop so timers without a habit sound still own the OS media session / lock-screen controls.

Completion: `habitComplete.wav` — short chime (bundled; Metro reload usually enough for asset-only changes).
