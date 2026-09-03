# Attachments — design before code

Attaching files to notes and journal days, kept local, sized in the UI, and carried in the backup.

Every claim carries a `file:line` that was read. Where something could not be verified it says so. **Nothing here is built yet** — no table, no dependency, no protocol field. Project rule: do not scaffold protocol/DB features early (`.claude/rules.md`).

Owner decisions this design is built on, already made and not relitigated here:

1. The backup format may change; it does not have to stay one JSON file.
2. It must stay **one artifact through the OS share sheet** — not a folder to manage.
3. Existing backups do not have to survive. Design the right thing, not the compatible thing.

Related: [protocol-plan.md](./protocol-plan.md) (full backup vs data slice vs share pack), [roadmap.md](./roadmap.md) (Session Export), rules `protocol-database.mdc`.

---

## 1. The backup path as it stands

### 1.1 Files

| File | Role |
|------|------|
| `src/utils/protocolBackup.ts` | One line: `export * from './protocolBackup.native'` (`:1`). Metro picks `.native.ts` / `.web.ts` by platform; this is the fallback Jest and Node resolve. |
| `src/utils/protocolBackup.native.ts` | Export → share sheet; import → document picker |
| `src/utils/protocolBackup.web.ts` | Export → Blob + anchor download; import → `<input type="file">` |
| `src/utils/protocolBackupFileName.ts` | `life-dashboard-backup-YYYY-MM-DD-HHmmss.json` (`:9-13`) |
| `src/utils/protocolBackupResult.ts` | `'saved'` (web) vs `'shared'` (native) → alert keys |
| `src/hooks/useProtocolBackup.ts` | Busy flag, confirm dialogs, alerts, store reload |
| `src/db/export.ts` | `exportProtocolBundle` (`:24`), `importProtocolBundle` (`:71`), `serializeBundle` (`:174`) |
| `src/protocol/bundle.ts` | `ProtocolBundleSchema` (`:39-60`), link validation (`:64-79`) |

### 1.2 Export, precisely

`exportProtocolBundle` takes the DB write lock and reads **sequentially** — "concurrent `prepareAsync` can fail on shared SQLite" (`export.ts:27`). Fourteen reads (`:28-41`) collapse into eleven keys on `createProtocolBundle` (`:46-67`).

`serializeBundle` is `JSON.stringify(bundle, null, 2)` (`export.ts:175`). **Pretty-printed, whole thing in RAM, two-space indent.** That single string is then handed to `FileSystem.writeAsStringAsync` (`protocolBackup.native.ts:47-49`), which makes a second full copy as native UTF-8 bytes. Peak memory today is therefore ≈ 2× the serialized text.

Sharing (`protocolBackup.native.ts:35-57`):

- Writes to `FileSystem.cacheDirectory ?? FileSystem.documentDirectory` (`:40`) — the cache is fine because the file is transient, the share sheet copies it.
- `Sharing.shareAsync(fileUrl, { mimeType: 'text/plain', UTI: 'public.plain-text' })` (`:52-56`).
- The comment says why (`:30-34`): *"`text/plain` is required so Android shows the app chooser (Proton Drive, Files, …) instead of the 'Use this folder' picker."* So a `.json` file is announced as plain text on purpose.

**The share sheet does not move bytes.** `expo-sharing` resolves the local path through `FileProvider.getUriForFile(...".SharingFileProvider", file)` and puts a `content://` URI on the intent (`node_modules/expo-sharing/android/src/main/java/expo/modules/sharing/SharingModule.kt:31-35`), granting read permission to every activity in the chooser (`:44-50`). The provider is scoped to `files-path`, `cache-path` and `external-path` (`node_modules/expo-sharing/android/src/main/res/xml/sharing_provider_paths.xml`). **File size is therefore not bounded by the share sheet or by Binder** — the receiving app streams the URI. Also note `SharingModule.kt:36-38`: with no explicit `mimeType`, it guesses from the file name.

### 1.3 Import, precisely

- Availability gate: `requireOptionalNativeModule('ExpoDocumentPicker') != null` (`protocolBackup.native.ts:18-20`) — an Expo Modules check, hence the "Needs a fresh app build" copy at `src/i18n/locales/en/settings.json:35`.
- `DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })` (`:68-71`). **`'*/*'` already accepts anything** — a zip needs no change here.
- `readAsStringAsync(uri)` → `JSON.parse` → `importProtocolBundle` (`:77-79`). Whole file as one JS string, then a whole object graph.
- `importProtocolBundle` (`export.ts:71-172`) normalizes, Zod-parses, then inside one transaction runs `clearDataForImport` and re-inserts every row. It bumps every data generation before and after (`:82`, `:170`) so in-flight writes abandon themselves (`src/db/dataGeneration.ts:62-71`).

### 1.4 Web

`Blob` + `URL.createObjectURL` + a synthetic anchor click (`protocolBackup.web.ts:18-24`); import via a hidden `<input type="file" accept="application/json,.json">` with a focus-based cancel heuristic (`:29-74`). Web is secondary (`.claude/rules.md`) and is the one place the `.json` accept filter is hard-coded.

### 1.5 Why binary cannot go in this file

`DAY_NOTE_BODY_MAX_LENGTH = 128_000` (`src/protocol/dayNote.ts:16`), shared by journals (`src/protocol/dailyJournal.ts:7`). That cap exists to keep the one JSON file sane. Base64 inside the same file would be ~1.33× the bytes as characters, on top of `JSON.stringify`'s copy and `writeAsStringAsync`'s copy — a 50 MB attachment set becomes roughly 67 MB of base64, held simultaneously as a JS string, a stringified bundle and native bytes. See §2 for the numbers.

---

## 2. Container format — three options

Judged against: one shareable artifact · phone memory for a 50 MB attachment set · streaming vs whole-file-in-RAM · implementation risk.

| | **A. Zip (manifest + `attachments/`)** | **B. One JSON, base64 blobs** | **C. Sidecar folder** |
|---|---|---|---|
| One artifact | Yes — one `.zip` through the existing share path | Yes | **No.** Android's share sheet takes file URIs, not a tree. The user manages a directory. |
| Peak RAM, 50 MB set | **Bounded by chunk size**, not by the payload — bytes go file → zip entry in fixed-size `readBytes` calls (§3.1) | ≈ 67 MB base64 string + a stringified copy + native bytes. Android OOMs on base64 strings in this class from ≈30 MB on low-end devices (§6.1), and `JSON.parse` repeats it on import | Low — files are copied one at a time |
| Streaming | Yes, both directions | No. `JSON.stringify` and `JSON.parse` are all-or-nothing by construction | Yes |
| Restore on a new device | Pick one file | Pick one file | User must reproduce a directory layout by hand |
| Inspectable on a desktop | Yes — any OS opens a zip | Yes, if a text editor survives a 67 MB line | Yes |
| Implementation risk | One new dependency; format is 30 years stable | None new, but it will OOM and there is no fix short of changing format | Low code, high UX cost |
| Verdict | **Recommended** | Rejected | Rejected — fails decision 2 outright |

**Recommendation: A, a zip.**

The single strongest reason is not compression — most attachments (JPEG, PNG, PDF, mp4) are already compressed and should be **stored, not deflated**. It is that a zip is the only one of the three where **no step requires the whole payload in memory at once**, while still being one file the share sheet already knows how to hand to Proton Drive.

Proposed layout:

```
life-dashboard-backup-2026-09-03-141523.zip
├── manifest.json          ~200 bytes: format id, format version, protocol version, counts
├── backup.json            today's ProtocolBundle + an `attachments` array
└── attachments/
    ├── 3f2a…c1.pdf
    └── 9b04…7e.jpg
```

Two JSON entries rather than one on purpose: `manifest.json` is small enough to read and reject in milliseconds without touching the payload, which is what makes the old-backup check in §8 a sentence instead of a Zod stack trace.

Rejected without a full column, for the record:

- **Two files (JSON + a zip of attachments).** Two artifacts. Fails decision 2.
- **Copy `lifeapp.db` itself.** WAL means the file on disk is not the database (`schema.ts:15` sets `journal_mode = WAL`), it is not human-inspectable, and it forecloses the granular export / share pack modes in `protocol-plan.md`.
- **A bespoke concatenated container with a header.** That is a zip with fewer readers and no desktop support.

### 2.1 What this costs at the share sheet

`mimeType` must change from `'text/plain'` (`protocolBackup.native.ts:53`) to `'application/zip'`. The comment at `:30-34` records that `text/plain` was chosen to make Android show the app chooser rather than a folder picker. **This is the one behavioural risk in the whole plan and it must be tested on the real device before the rest is built** — see §9. If `application/zip` narrows the chooser, `application/octet-stream` is the fallback; either way the file name still ends `.zip`, which is what `SharingModule.kt:36-38` would guess anyway.

---

## 3. The zip library

**There is no zip dependency today.** Verified: nothing matching `zip|fflate|pako|archive` in `package.json`, and `node_modules/{fflate,jszip,react-native-zip-archive,pako}` do not exist — so not even a transitive one.

**Expo ships no zip API and no first-party zip module.** `expo-file-system` 19 has no compression or archive surface of any kind — confirmed against the SDK 54 docs page and against the installed types locally (`node_modules/expo-file-system/build/ExpoFileSystem.types.d.ts`, `FileSystem.d.ts`, `streams.d.ts`: no archive symbol anywhere). A community `expo-archive` exists and was not evaluated.

### 3.1 What `expo-file-system` 19 does give us

This is the finding that decides the rest, and it is verifiable locally rather than from docs. The installed 19.0.23 exposes, on `File`:

| API | Where |
|---|---|
| `bytes(): Promise<Uint8Array>` / `bytesSync()` | `ExpoFileSystem.types.d.ts:197`, `:202` |
| `write(content: string \| Uint8Array, options?)` | `:207` |
| `open(): FileHandle` | `:247` |
| `FileHandle.readBytes(length)` / `writeBytes(bytes)` / settable `offset` / `size` | `:306-312` |
| `readableStream()` / `writableStream()` / `slice()` — `File implements Blob` | `FileSystem.d.ts` |
| `size`, `md5`, `type` (mime), `contentUri` | `:283`, `:287`, `:299`, `:304` |
| `Paths.availableDiskSpace` / `totalDiskSpace` | `FileSystem.d.ts`, `class Paths` |

The current code does none of this — it is still on `expo-file-system/legacy` in all three call sites (`protocolBackup.native.ts:2`, `presentNoteShare.ts:1`, `legacyHabitSoundCleanup.ts:6`). **Byte-range reads and writes with no base64 anywhere is exactly what a streaming zip writer needs**, and it is already installed.

### 3.2 The candidates

Dates are as reported by `registry.npmjs.org`; they could not be cross-checked against npmjs.com (403 on every page fetch), so treat them as registry-reported rather than confirmed.

| | **fflate** | **jszip** | **react-native-zip-archive** |
|---|---|---|---|
| License | MIT | `(MIT OR GPL-3.0-or-later)` — dual | MIT |
| Latest / published | 0.8.3, 2026-05-16 | 3.10.1, **2022-08-02** | 9.4.1, 2026-08-31 |
| Maintenance | Last commit same day as the release | No release in four years; 413 open issues | 9.1–9.4 all landed Jul–Aug 2026 |
| Native? | No — pure JS, zero deps | No — pure JS, 4 deps (`pako`, `readable-stream`, `lie`, `setimmediate`) | **Yes.** Autolinking + full rebuild; not usable in Expo Go |
| Config plugin | None needed | None needed | Ships one, but `app.plugin.js` is a literal no-op — autolinking does the work |
| New Architecture / RN 0.81 | N/A — never touches native | N/A | TurboModule confirmed: `codegenConfig.name = NativeZipArchiveSpec`. **RN 0.81 itself untested upstream** — peer dep is `>=0.70.0`, their e2e app pins Expo 55 / RN 0.83 |
| Streaming to/from a path | Not directly, but its sync **streaming classes** (`Zip`, `ZipPassThrough`, `ZipDeflate`, `Unzip`, `UnzipInflate`) take and emit chunks via `push()` / `ondata` — pair them with `FileHandle.readBytes`/`writeBytes` and nothing is ever whole | **No.** `loadAsync` needs the whole archive already in memory; `generateAsync` "the processed file is held in memory" | **Best.** Path in, path out (`zip(source, target)`, `unzip(source, target)`), plus `listContents`, progress `subscribe()`, `cancel()`. Nothing crosses into JS |
| RN gotcha | **Its async/worker APIs never resolve in RN** — no Web Workers ([fflate#236](https://github.com/101arrowz/fflate/discussions/236), no maintainer reply). Sync-only, so zipping runs on the JS thread. No WASM; `TextEncoder`/`TextDecoder` guarded at source and present in Hermes; no Buffer polyfill | Metro polyfill friction via `readable-stream` → `stream` (`stream-browserify` + `buffer` + `process`). **Not confirmed** for this Metro/SDK 54 config | Zip Slip / symlink-escape fix reached iOS parity only in **9.4.1** — pin `>=9.4.1` |
| Verdict | **Recommended** | Rejected | Fallback, named trigger below |

### 3.3 Recommendation: fflate, sync streaming classes only

**Single strongest reason: it costs no rebuild and adds no native surface, and the one thing a native library buys over it — moving CRC32 off the JS thread — is not worth a native dependency for an operation the user taps deliberately and watches a progress bar for.**

Supporting points:

- **Attachments must be stored, not deflated.** JPEG, PNG, PDF and mp4 are already compressed; deflating them burns CPU to grow the file. Use `ZipPassThrough` for attachment entries and `ZipDeflate` only for the two JSON entries. That removes almost all of fflate's compression cost, leaving CRC32 and framing.
- **Entry names are ours.** The content-addressed layout in §4.2 depends on writing entries at exact paths (`attachments/<md5>.<ext>`). fflate gives that by construction. Whether `react-native-zip-archive` can produce a chosen entry path from an arbitrary source path was **not confirmed** — if it cannot, the export has to stage a directory first, copying every attachment, which doubles disk use at precisely the point §6 identifies as the binding constraint.
- **We control the yielding.** Because we feed the chunks, the export can `await` between them and keep the UI alive. fflate's own worker path is dead in RN, so this is the only option there anyway — but here it is a feature, not a workaround.
- **Chunk the reads, and keep entry counts sane.** fflate's README warns to keep under ~5,000 files per `Unzip.push()` chunk to avoid stack limits. Not reachable under §6's caps.

**Named trigger to switch to `react-native-zip-archive`:** if a measured export of a realistic attachment set janks the UI beyond what a progress indicator excuses, or if native progress/cancel becomes a requirement. It is MIT, actively maintained, a real TurboModule, and its file-path API is genuinely better — it just is not worth a rebuild and an untested-on-0.81 native module until measurement says so. **jszip is ruled out on all three axes at once:** unmaintained, whole-archive-in-memory both directions, and Metro polyfills on top.

---

## 4. Attachment storage on the device

### 4.1 Where

**`documentDirectory`, not `cacheDirectory`.** The distinction is already used deliberately in both directions in this repo:

- `src/notes/presentNoteShare.ts:19` writes share files to `cacheDirectory ?? documentDirectory` — transient by design, the OS may evict them and nothing is lost.
- `src/audio/legacyHabitSoundCleanup.ts:7-10` cleans a *document*-directory tree, guarding on `${docDir}habit-sounds/` and `${docDir}sounds/` prefixes before deleting — a managed durable subtree with a prefix check so a stray URI cannot be used to delete something else.

Attachments are user data. Cache eviction would silently destroy them. Proposed root: `<documentDirectory>attachments/`, with the same prefix guard before any delete.

Android backup is off (`app.json:31`, `"allowBackup": false`), so nothing in `documentDirectory` leaves the device except through the share sheet. That is the privacy stance in `roadmap.md` and this feature does not change it.

### 4.2 Naming and deduplication

**Content-addressed: `<md5>.<ext>`.**

`expo-file-system` 19 exposes `md5` as a native property on `File` (`node_modules/expo-file-system/build/ExpoFileSystem.types.d.ts:287`), alongside `size` (`:283`), `type` — the mime type (`:299`) — and `contentUri` (`:304`). So the hash costs one native call and no JS loop over the bytes. MD5 is used here for identity, not security; a collision in a personal attachment store is not a threat model.

Consequences, all of them good:

- The same PDF attached to three days occupies one file and three rows.
- Re-attaching a file already present is a no-op write.
- The zip entry name is the storage key — no name mangling, no collision between two files both called `scan.pdf`.
- The user-visible name is a separate `display_name` column, so renaming is metadata-only.

Deleting a row must delete the file **only when no other row references that md5** — one `COUNT(*)` before the unlink.

### 4.3 Orphan cleanup

Two directions, both needed:

| Orphan | When | Sweep |
|--------|------|-------|
| Row with no file | Restore skipped a missing zip entry; user cleared storage | On the `repair` pass — precedent: `repairDayNotes` deletes rows whose element is gone (`src/db/schemaRepairs.ts:45-47`) |
| File with no row | A delete failed halfway; an import replaced the table | Sweep `<documentDirectory>attachments/` against `SELECT storage_key`, delete the difference. Run after import and after a clear, not on every boot |

The single table proposed in §5 is polymorphic over two owner types, so it **cannot** carry a foreign key and cannot rely on `ON DELETE CASCADE` the way `day_notes` does (`persistedConcepts.ts:211`). That is the real cost of one table instead of two, and it is paid with an explicit sweep at the three code paths that delete an owner:

- `elementRepository` delete (tracker removed)
- `journalNotebookRepository.deleteNotebook` (`src/db/repositories/journalNotebookRepository.ts:132`) — which already performs a deliberate reassign-then-delete dance because journals have no cascade either, and says why (`src/db/repositories/dailyJournalRepository.ts:53-61`)
- the repair pass, as the backstop

In-repo precedent for the polymorphic shape: `note_share_state` is keyed `(kind, element_id, entry_id, date)` with no FK (`persistedConcepts.ts:384-392`).

### 4.4 Clear data

Attachments are day facts, so they follow `day_notes`' stances (`persistedConcepts.ts:217-221`):

| Axis | Stance |
|------|--------|
| `definitions` | `DELETE FROM attachments` + file sweep |
| `activity` | Same |
| `activityBefore` | `DELETE FROM attachments WHERE date < ?` + file sweep |
| `onImport` | Inherits `definitions` — an import replaces the device (`persistedConcepts.ts:512-522`) |
| `ambient` | None |

Every clear runs inside `clearAppData`'s transaction (`resetAppData.ts:128-161`). **File deletion must happen after that transaction commits, never inside it** — a rolled-back transaction cannot un-delete a file. The sweep-against-rows design in §4.3 makes that safe: if the process dies between commit and sweep, the next sweep finishes the job.

---

## 5. The schema

### 5.1 What it links to — and the trap

The obvious design is `attachments.note_id → day_notes.id`. **It is wrong, and the reason is not obvious.**

`upsertNote` deletes the row when the body is whitespace (`src/db/repositories/dayNoteRepository.ts:165-177`), and mints `existing?.id ?? newId()` when it comes back (`:183`). `upsertJournal` does the same for chapters (`src/db/repositories/dailyJournalRepository.ts:212-216`, `:223`). So:

> Clear a note's text, type something else, and the note has a **new id**. Anything hanging off the old id is orphaned by an ordinary edit.

Chapter ids are further churned by `reassignJournalsToNotebook` and `renumberChapters` (`dailyJournalRepository.ts:262-301`).

What *is* stable is the day coordinate: `(element_id, date)` for a tracker note — it is the `UNIQUE` key of `day_notes` (`persistedConcepts.ts:212`) — and `(notebook_id, date)` for a journal day.

**Recommendation: attach to the day, per tracker or per notebook.** One shelf per (owner, date). This survives clearing and retyping the text, survives chapter renumbering, and matches how a person thinks about it ("the scan I put on Tuesday"). It also means an attachment can exist on a day with no text at all, which is a feature: a photo *is* the note. `DayNoteSchema.body` requires `min(1)` (`dayNote.ts:23-25`), so an attachment must not depend on a note row existing.

Per-chapter attachment is left as an open question (§9), not designed here.

### 5.2 Proposed DDL

One entry in `PERSISTED_CONCEPTS` (`src/db/persistedConcepts.ts`), declared **after** `dailyJournals` and before `foodItems` — declaration order is creation order (`:118-119`). Every statement `IF NOT EXISTS`, because `SCHEMA_SQL` runs on every open (`src/db/schema.ts:10-12`).

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  -- 'tracker' → owner_id is elements.id; 'journal' → owner_id is journal_notebooks.id.
  -- Polymorphic on purpose, so there is no FK and no cascade: the owner deletes
  -- sweep explicitly (see the repair pass and journalNotebookRepository.deleteNotebook).
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  -- The day this is filed under. Deliberately NOT day_notes.id / daily_journals.id:
  -- clearing a body deletes that row and a retype mints a new id.
  date TEXT NOT NULL,
  -- File name under <documentDirectory>attachments/. Content-addressed: '<md5>.<ext>'.
  -- Several rows may share one key; the file goes only when the last row does.
  storage_key TEXT NOT NULL,
  content_md5 TEXT NOT NULL,
  -- What the user sees and what the zip restores as. Renaming is metadata only.
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  protocol_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_owner_date
  ON attachments(owner_kind, owner_id, date);
CREATE INDEX IF NOT EXISTS idx_attachments_md5 ON attachments(content_md5);
```

Concept entry, in the shape the file demands (`persistedConcepts.ts:77-97`):

| Field | Value |
|-------|-------|
| `name` | `'attachments'` |
| `tables` | `['attachments']` |
| `ddl` | above |
| `repair` | `repairAttachments` — drop rows whose owner is gone, in `src/db/schemaRepairs.ts` beside `repairDayNotes` (`:45-47`) |
| `clear` | §4.4 |
| `bundleKey` | `'attachments'` — a new optional array on `ProtocolBundleSchema` |

### 5.3 Migration

`CURRENT_SCHEMA_VERSION` is **22** (`src/db/migrations.ts:24`). This is **v23**: one `ensureAttachmentsSchema(db)` hop, plus a one-line comment in the ladder of `/** vNN: … */` notes (`migrations.ts:25-46`), following v21's shape exactly (`:234-236`). Never edit a shipped migration in place — at the steady state the repair pass is skipped and `CREATE TABLE IF NOT EXISTS` is a no-op, so a changed migration never arrives (`.cursor/rules/protocol-database.mdc`, and the same warning at `persistedConcepts.ts:37-40`).

### 5.4 The test that will not compile

`__tests__/persistedConcepts.test.ts` drives every check off `PERSISTED_CONCEPTS`, and `SEEDS` is `Record<PersistedConceptName, …>` (`:82-85`). **Declaring the concept breaks the build until a seed row is written.** The seed then has to satisfy six generated tests per concept (`:306-387`), including the backup round-trip at `:373-386` — which means `exportProtocolBundle` / `importProtocolBundle` must carry attachments *before* the test can pass. There is no way to land the table and wire the backup later. The final assertion at `:389-399` also compares declared tables against every table a fresh install creates, so the table cannot be added anywhere else.

Note the seed runs against `node:sqlite` in memory (`:254`, `:286`) with no filesystem — so the metadata row must be insertable without the file existing. The proposed DDL satisfies that; a `CHECK` tying rows to files would not.

### 5.5 `PROTOCOL_VERSION` — do not bump it

The owner said a bump is acceptable. It is not needed, and spending it here would be a mistake.

`PROTOCOL_VERSION = 1` (`src/protocol/envelope.ts:3`) governs *interchange shape*, and `protocol-plan.md` is explicit: bump only on breaking changes, prefer additive optional fields. `attachments` on `ProtocolBundleSchema` is exactly the additive optional array that `todos` (`bundle.ts:56`) and `dailyJournals` (`:48`) already are — each annotated *"optional for older backups"*.

What changes is the **container**, which is not protocol at all. Give it its own constant — `BACKUP_FORMAT_VERSION = 2` in `manifest.json` — and leave the protocol at 1. Old `.json` backups stop being importable because the importer now expects a zip, not because a Zod literal rejected them.

One detail that makes a future bump cheap if it is ever genuinely needed: repositories re-parse rows with the **constant** substituted for the stored column — `dayNoteRepository.ts:22` passes `PROTOCOL_VERSION`, not `row.protocol_version`. Stale `1`s in the database would not break reads.

---

## 6. Size limits and the size indicator

Numbers derived from what actually breaks, not picked round.

### 6.1 What constrains what

| Constraint | Real limit | Where it bites |
|---|---|---|
| Share sheet | None — a `content://` URI, streamed by the receiver (`SharingModule.kt:31-50`) | Nowhere |
| Free storage | Readable: `Paths.availableDiskSpace` (`node_modules/expo-file-system/build/FileSystem.d.ts`, `Paths.availableDiskSpace`) | An export writes the zip **beside** the originals, so it needs ≈ 1× the attachment bytes free, on top of them |
| JS heap | Only where a whole file must be a string or array at once | The clipboard paste path (below) and any non-streaming zip step |
| Zip format | 4 GB per entry / 65535 entries without ZIP64 | Not reachable under the caps below |

**The clipboard is the one unavoidable whole-file-in-RAM step, and it is the only base64 left in the design.** `expo-clipboard` returns a pasted image as `ClipboardImage.data`, *"A Base64-encoded string of the image data … already prepended with `data:image/png;base64,`"* (`node_modules/expo-clipboard/build/Clipboard.types.d.ts:13-27`), via `getImageAsync({ format: 'png' | 'jpeg', jpegQuality? })` (`Clipboard.d.ts:90`, options at `Clipboard.types.d.ts:1-12`). There is no byte or stream variant. `hasImageAsync()` (`Clipboard.d.ts:113`) lets the UI offer the paste action only when there is something to paste.

For scale, [expo#20291](https://github.com/expo/expo/issues/20291) collects measured OOM thresholds for base64 strings of this size class on Android: **≈30 MB on low-end devices, ≈75 MB on post-2020 flagships**, reproduced even with `largeHeap=true`; a second report ([expo#2703](https://github.com/expo/expo/issues/2703)) sees crashes from roughly 8 MB on a constrained device. Those figures are for the legacy `readAsStringAsync` path rather than the clipboard bridge, so they are indicative rather than exact — but they set the order of magnitude, and the 8 MB paste cap below sits under the worst of them.

Everything else avoids base64 entirely: the picker copy is file-to-file, and the zip is written through `FileHandle.writeBytes` (§3.1).

The file picker has no such problem: `expo-document-picker` hands back a URI plus `name`, `size` and `mimeType` (`node_modules/expo-document-picker/build/types.d.ts:33-49`), and it already supports `multiple: true` (`:24`). Copying picker URI → `attachments/` is a file-to-file copy.

### 6.2 Proposed caps

| Limit | Value | Reasoning |
|---|---|---|
| Per file | **25 MB** | Above every realistic case — a 12 MP JPEG is 3–6 MB, a 40-page scanned PDF ≈ 10 MB — and small enough that a mistake stays recoverable. Enforced from `DocumentPickerAsset.size` *before* copying, so an over-limit file is never written. |
| Per clipboard paste | **8 MB** | This is the one path that must fit in a JS string (§6.1); 8 MB of image is ≈ 11 MB of base64. A screenshot is well under 2 MB. |
| Per (owner, day) | **no hard cap**, warn past 10 files | A count limit would be arbitrary; the running total in the UI is the honest signal. |
| Backup total | **soft warn at 200 MB**, proceed/cancel | Not a memory limit — nothing holds it in RAM. It is a *time and upload* limit: 200 MB is minutes over mobile data into Proton Drive, and the user should choose knowingly. |
| Backup hard gate | `Paths.availableDiskSpace` < (attachment bytes × 1.2) → refuse with the number | The export genuinely cannot complete without the space. Refusing with "needs 340 MB free, 190 MB available" is a better failure than a half-written zip. |

### 6.3 The indicator

Three places, one formatter (`formatBytes`, new, beside the other pure formatters in `src/utils/`):

1. **Per attachment row** in the editor — `scan.pdf · 2.4 MB`.
2. **Per day** — a total on the attachment shelf once there is more than one file.
3. **Settings → Data** — a line under Export backup: attachment count and total, so the size of the next backup is known before tapping. Strings go in the `settings:data` namespace (`src/i18n/locales/en/settings.json:29-69`), EN and FR in the same change.

Sizes are read from `byte_size`, which is stored at attach time — never by walking the directory on render.

Appearance rules apply unchanged: size text is `QuietText`, never dimmed with `opacity`; the row uses `minHeight`; spacing from `space`, corners from `deco.radius` (`.claude/rules.md`, enforced by `themeContrast.test.ts`, `noTextOpacity.test.ts`, `fontScaling.test.ts`).

---

## 7. Someone holding an old backup

They cannot import it. That is the accepted cost of decision 3. What matters is that it fails as a **sentence, not a crash**.

Today an old `.json` would reach `JSON.parse` (`protocolBackup.native.ts:78`) and then `ProtocolBundleSchema.parse`. Under the new importer it reaches a zip reader instead, which would throw something unreadable about a bad central directory.

The check, before anything else touches the file: a zip begins with the local file header signature `PK\x03\x04` — bytes `0x50 0x4B 0x03 0x04`. `expo-file-system` 19 can read exactly four bytes without loading the file: `new File(uri).open().readBytes(4)` (`FileHandle.readBytes` at `node_modules/expo-file-system/build/ExpoFileSystem.types.d.ts:306-312`).

```
not PK\x03\x04  →  settings:data.importOldFormatBody
```

Copy, EN and FR together: *"This backup was made by an older version of Life Dashboard and can no longer be imported."* One string, one branch, no legacy parser.

**The cheap escape hatch, if the owner wants one release of grace:** where the signature check fails, try `JSON.parse` and run the existing path with no attachments. Roughly five lines. The argument against is symmetry — nothing would produce that format any more, and the code would be the only untested writer-less reader in the module. Listed as an open question (§9), recommendation is to refuse.

`protocolBackup.web.ts:32` also hard-codes `accept="application/json,.json"` and must change to `.zip` in the same commit, or the web importer silently cannot see the new file.

---

## 8. What has to change, in order

Not a schedule — a dependency order, because §5.4 means several of these cannot be split.

| # | Change | Note |
|---|--------|------|
| 1 | Confirm `application/zip` still shows Proton Drive in the Android chooser | §2.1. Ten-minute test against the current build. **Everything else depends on it.** |
| 2 | `npm i fflate` | §3. No rebuild, no config plugin, no `app.json` change |
| 3 | `attachments` concept + v23 migration + `repairAttachments` + seed row | One commit — the test does not compile otherwise (§5.4) |
| 4 | `attachmentRepository` + a file store module owning `<documentDirectory>attachments/` | All SQL in the repository; nothing else calls `db.runAsync` (`.claude/rules.md`). Writes through `withGuardedWrite` (`dataGeneration.ts:62`) |
| 5 | `attachments` on `ProtocolBundleSchema`; zip export + import; `manifest.json`; signature check | Same commit as 3–4 in practice |
| 6 | File name `.zip`, mime type, web `accept` | `protocolBackupFileName.ts:12`, `protocolBackup.native.ts:53`, `protocolBackup.web.ts:32` |
| 7 | Editor UI — attach button, shelf, size, delete | Action row is `src/notes/NoteEditorActions.tsx:35-66` (undo/redo left, mic + Done right; share and overflow live in the header, `:18-21`) |
| 8 | EN + FR strings | Same change, always (`ui-i18n.mdc`) |

Jest note: `transformIgnorePatterns` in `jest.config.js:20` allowlists only the Expo/React Native scopes plus `react-native-svg` and `uuid`. If `fflate` resolves to ESM under Jest it has to be added there. Also `testMatch` is `**/__tests__/**/*.test.ts` (`jest.config.js:15`) — `.tsx` tests are not collected, so the zip round-trip test must be plain `.ts`, which it can be: it is pure bytes in, bytes out.

---

## 9. Risks and open questions

**Risks**

1. **`application/zip` and the Android chooser.** The `text/plain` comment (`protocolBackup.native.ts:30-34`) records that this was tuned once already. Test first (§8, step 1).
2. **Zipping runs on the JS thread.** fflate's worker APIs do not resolve in React Native ([fflate#236](https://github.com/101arrowz/fflate/discussions/236)), so CRC32 and framing happen in Hermes. Storing rather than deflating (§3.3) removes most of it, and feeding chunks ourselves lets the export yield — but this needs measuring on the real device, not assuming. It is the named trigger for the native fallback.
3. **Attachments make "Clear data" irreversible in a new way.** Today clearing loses rows the user typed. Now it can lose a document that exists nowhere else. The confirm copy (`settings:data.clearConfirmSuffix`) needs to say so.
4. **Files outlive the transaction.** §4.4 — delete files only after commit, and let the sweep finish an interrupted delete.
5. **A restore onto a phone with less free space than the source.** The pre-flight gate in §6.2 is what turns this into a message instead of a corrupt half-import.
6. **Untrusted zip entries.** An imported archive is user-chosen but not user-authored. Entry paths must be validated before writing — reject anything containing `..` or a leading `/`, and accept only `manifest.json`, `backup.json` and `attachments/<basename>`. This is the Zip Slip class that `react-native-zip-archive` had to patch as recently as 9.4.1; with fflate the check is ours to write, and it is four lines.
7. **Stale Gradle output at `modules/life-backup-file-picker/android/build/`** with no source and no `package.json` entry — evidently an abandoned local module. Harmless, but it will confuse anyone touching the picker. Unrelated to this plan; worth deleting on its own.

**Open questions for the owner**

1. **Day-level or chapter-level?** §5.1 recommends the day, because chapter ids do not survive an ordinary edit. Chapter-level is possible but needs stable chapter ids first — a separate change to `upsertJournal`.
2. **Can an attachment exist with no text?** The recommendation assumes yes (a photo is the note). If yes, Home's "has a note today" indicators need to count attachments too, or a day with only a photo looks empty.
3. **Does anything render inline?** A thumbnail for images is a different feature from a file row with a size — decoding, caching and a full-screen viewer. Recommendation: ship the file row first.
4. **Are attachments in a *share pack*?** `protocol-plan.md` says share packs carry templates, not personal data. Attachments are unambiguously personal — recommend never, and say so in the plan so it is not re-decided.
5. **Do attachments go out with the note share?** Today share writes a `.txt` (`src/notes/presentNoteShare.ts:9`). Sharing a note with a PDF would need a multi-file share or a second zip. Recommend: out of scope, text only, until asked.
6. **One release of grace for `.json` imports?** §7. Recommendation: no.
7. **Encryption at rest?** `allowBackup=false` (`app.json:31`) keeps files off Google's servers, but the exported zip is plaintext wherever it lands. Passphrase-encrypting the backup is a real feature with a real footgun (a forgotten passphrase is a destroyed backup). Not designed here.
