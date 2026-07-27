# src/lib — the colour, logo, and identity data model

Pure data and pure functions, no React. This file covers the **club identity
layer**: which colours a club owns, which mark a tile wears, and how a
hand-tuned adjustment gets from someone's eye into the app. The other modules
here (routing, dates, formatting, run expectancy, …) are documented at their own
tops. Screens and components are in `src/CLAUDE.md`; the fetch/selector layer is
in `src/api/CLAUDE.md`.

## The two vocabularies

**MLB is keyed by treatment** — `main`, `alternate`, `alternate-2/3/4`,
`city-connect` — the same vocabulary `public/data/jerseys.json` and
`api/jerseys.js` use, because a real game's tile is picked from the jersey that
club actually wore that night. Real per-jersey art and colours exist and are
worth curating one at a time.

**MiLB is keyed by variation** — `home` / `away`, no exceptions. There is no
MiLB uniform feed (`docs/uniforms-and-logos.md`), and affiliates wear too many
one-off jerseys, reported too inconsistently, for a treatment catalog to pay for
itself. Each affiliate gets one researched primary/secondary pair, swapped
between the two variations.

Keeping these separate is deliberate. Forcing parity would mean inventing data
one side doesn't have.

## Where a value lives

| Module | Owns |
| --- | --- |
| `teams.js` | Club names/abbreviations/ids, logo URL builders, the brand-colour tables (`TEAM_COLOR_PAIRS`, `ALT_COLORS`, `CITY_CONNECT_COLORS`, `ALT2/3/4_COLORS`), and every MLB tile resolver — `treatmentTile` is the one every surface goes through |
| `milbColors.js` | The MiLB counterpart: researched pairs, the Home/Away resolvers, `milbTreatmentTile` |
| `wpaLogo.js` | Which mark tiles a win-probability band, its layout geometry, and whether it may be recoloured |
| `wpaBandColors.js` | That band's fill/pinstripe resolution |
| `logoMono.js` | The one-colour knockout marks for navy mastheads (ADR-0025) |

`treatmentTile(teamId, treatment)` is the single resolver behind the slate card
(`GameCard`), the in-game masthead (`GameView`), and the lab's own grid — a club
whose mark needs a scale-down or a recolour to read against its own fill needs it
in all three, so there is one answer, not three.

## The hand-tuned stores (`src/lib/data/*.json`)

Values tuned by eye — an edge-bleed scale, a nudge, a band colour, a header
triad — live on disk as JSON rather than as JS literals, so the Team Identity
Lab can write an edit straight back instead of handing over a snippet to paste
(ADR-0029).

| File | Read by |
| --- | --- |
| `mlb-treatment-tuning.json` | `teams.js` |
| `milb-treatment-tuning.json` | `milbColors.js` |
| `milb-colors.json` | `milbColors.js` |
| `wpa-tuning.json` | `wpaLogo.js`, `wpaBandColors.js` |

Every store has the same outer shape:

```json
{ "<teamId>": { "name": "…", "treatments": { "<key>": { …fields, "note": "…" } } } }
```

`name` and `note` are the per-entry comments these tables carried as literals,
kept as data so a 900-line JSON diff still says which club moved and why a value
is odd. **No resolver reads either one** — they exist for humans, and the lab
renders `note` as an editable field so rationale is authored in the tool rather
than lost on the first write.

`tuningStore.js` holds the readers. Each consuming module rebuilds the exact
`{ [teamId]: { [treatment]: value } }` table it used to declare inline, so every
resolver below it — and every test pinning one — is untouched by the move. **The
store is the authoring format; those tables are still the lookup format.**

Two things to know before editing:

- **Main's scale is not a treatment scale.** `treatments.main.scale` resolves
  through `mainTreatmentScale` only; `treatmentScale(id, 'main')` returns 1, and
  `treatmentTile` routes Main through the `mainTreatment*` readers. That's why
  `byTreatment` takes `includeMain: false` for those tables — merging the two
  would apply Main's scale twice on every slate card. Pinned by
  `test/identity-lab-stores.test.js`.
- **Imports need the attribute.** `import x from './data/x.json' with { type: 'json' }`
  — Vite is happy either way, but the unit suite imports these modules in plain
  Node, which requires it.

## Editing a value

Run `npm run dev`, open `/identity-lab`, tune, and hit Save; the store is
rewritten sorted by team id and the page hot-reloads off the landed value. The
endpoint exists only under `vite dev` — see ADR-0029 for the allowlist and the
four layers that keep it out of production.

A few values have no home in a store yet and still land by hand from an editor's
copy icon: the flat background hex for a non-Main MLB treatment lives in
`ALT_COLORS` and friends, which are still JS literals.

## The rule that must not drift

**Theming's only inputs are `(teamId, treatment)`.** Identity, never state. The
tempting future violation is obvious — "tint the page by whoever's leading" —
and it *would* be a spoiler (root `CLAUDE.md`). Nothing in this directory may
read a score, an inning, or a win probability to decide a colour.
