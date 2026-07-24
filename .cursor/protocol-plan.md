# Life Protocol — plan & guardrails

Intent for how data is shaped and shared. Code stays in `src/protocol/`; this doc is the north star so features do not invent parallel models.

**Status:** Protocol **v1** · kinds: `habit`, `counter` · full backup via `ProtocolBundle` · granular export / catalogs / marketplace = planned, not scaffolded.

Related: [roadmap.md](./roadmap.md) (Session Export), [product-ideas.md](./product-ideas.md) (food, etc.), rules `project-architecture.mdc` + `protocol-database.mdc`.

---

## Why it exists

1. **Local-first truth** — validated shapes in SQLite; app logic reads protocol, not ad-hoc JSON.
2. **Portable personal data** — backup / restore / migrate devices.
3. **Future share** — habits, counters, foods, recipes as validated packs others can import — without uploading personal events by default.

---

## Three data classes

Never collapse these into one “kind of thing.”

| Class | Role | Examples | On Home? | In share pack? |
|-------|------|----------|----------|----------------|
| **Trackers (element kinds)** | Definitions the user logs against daily | `habit`, `counter` | Yes | Templates (config), not history |
| **Catalogs** | Libraries to browse, edit, remix, bake in | Food items, recipes (later) | No (unless a tracker logs against them) | Yes — slices of the library |
| **Ambient / app** | Convenience around the day; not Life Protocol kinds | Calendar, weather, theme, quotes | Peek / chrome | Usually no (or separate) |

**Trackers** = `ElementDefinition` + `LifeEvent`s.  
**Catalogs** = first-class protocol entities *outside* `ElementKind` until (and unless) UX truly needs a Home widget kind.  
**Ambient** = may appear in `ProtocolBundle` for backup (e.g. calendar) but must not become element kinds.

Day notes and daily journals sit beside trackers (linked / day-scoped personal text) — personal data, not share defaults.

---

## Core model (v1)

```
ElementDefinition  →  what it is (kind + name + config)
LifeEvent          →  fact: value + timestamp + calendar date (+ optional meta)
DashboardItem      →  Home pin / sort (active elements only)
ProtocolBundle     →  full personal snapshot for backup
```

- **Events are facts.** Prefer append; some same-day UI flows replace that day’s rows for one element — never rewrite history across days or invent mutable “current state” rows as the source of truth.
- **Daily aggregate** = `SUM(event.value)` per element per date. Kind config defines completion / targets (`semantics.ts`).
- **Config** must pass kind Zod on write. Unknown kinds / configs fail closed.
- **`PROTOCOL_VERSION`** bumps only on breaking interchange changes. Prefer additive optional fields and kind-local evolution when possible.

### Tracker config: identity vs device taste

When designing fields (and later share toggles), classify:

| Identity / behavior (share by default) | Device / taste (opt-in) |
|----------------------------------------|-------------------------|
| kind, name, schedule, targets, unit, icon, tracking mode | timer sound track, remind-minutes, streak-on-card, local paths |

Do not bake device taste into “required to understand this tracker.”

---

## Export modes (plan)

Evolve export without replacing the protocol — different *views* of the same schemas.

| Mode | Contents | Use |
|------|----------|-----|
| **Full backup** | Everything personal (`ProtocolBundle` today) | Device migrate / safety net |
| **Data slice** | Chosen types ± date range (events, notes, journals, …) | Session Export; merge vs replace |
| **Share pack** | Tracker **templates** ± catalog slices; **no events** by default | Send habits/foods to someone; marketplace later |

Share pack toggles (examples): include timer sound, include reminder prefs, include icons-only vs full config.

Import of share packs **installs new local UUIDs** (template → instance). Optional later: `originId` / pack id for remix updates — do not add until publishing needs it.

---

## Catalogs (food, recipes, …)

- User-owned databases: create, edit, delete, organize.
- May ship with optional baked-in starter packs.
- Recipes compose food items; meal logging (when built) references catalog ids via events or a dedicated log — design when the feature is scheduled.
- **Do not** add `food` / `recipe` to `ElementKindSchema` just because they are “things in the app.” Prefer catalog tables + protocol schemas; add a kind only if Home tracking UX diverges like habit vs counter.

Open until scheduled: nutrition depth, photos, dictation for meals — see product-ideas.

---

## Marketplace (distant)

Distribution of **share packs**, not accounts-required sync of personal life data.

- Browse / download / import templates + catalogs.
- Events, journals, notes stay on device unless the user explicitly exports a data slice.
- Moderation, authorship, and pack versioning are product concerns on top of the pack format — not reasons to weaken local validation.

---

## Decision checklist (before coding)

When adding a feature, answer:

1. **Tracker, catalog, ambient, or personal text?** Pick one class; do not overload `ElementKind`.
2. **Does UX diverge enough for a new kind?** If not, extend habit/counter config or stay ambient/catalog.
3. **What is `event.value` and the daily rule?** If you cannot say, it is not a tracker event yet.
4. **Backup vs share?** New persisted data: full backup yes/no; share pack default include/exclude; taste fields opt-in.
5. **Schema now?** Only when the feature is in progress — no speculative Zod/tables (project rule).

---

## Do not

- Scaffold food/recipe/marketplace schemas before that work is scheduled.
- Put calendar/weather/quotes/settings into `ElementKind`.
- Treat `ProtocolBundle` as the only interchange forever — granular + share pack are planned specializations.
- Upload events by default for “sharing.”
- Bypass Zod on write or invent a second JSON shape for the same entity in UI/store.
- Skip layers: protocol → repositories → kinds/handlers → store → screens.

---

## When to touch protocol code

| Change | Action |
|--------|--------|
| New tracker kind | `kinds/<k>.ts` + `ElementKindSchema` + handler/widget + registry; bump only if interchange breaks |
| New catalog | New protocol module + DB + bundle optional section when backup should include it |
| New ambient backup field | Optional on `ProtocolBundle`; keep out of element kinds |
| Share / granular export | Export/import UI + pack builders over existing schemas; avoid forking definitions |
| Breaking field meaning | Bump `PROTOCOL_VERSION`; migration / normalize path for old backups |
