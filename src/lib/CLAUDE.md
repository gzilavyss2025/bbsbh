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

## The one colour chain

Both vocabularies bottom out in the same three-step resolution, in
`brandColors.js`:

```
1. the affiliate's own researched pair   (data/milb-colors.json)
2. its parent MLB org's pair             (via MILB_PARENT_ORG)
3. NEUTRAL_FALLBACK_PAIR                 (milbColorPair only)
```

`milbBrandPair` is steps 1–2 and returns **null** when neither hits;
`milbColorPair` adds step 3. One ordering, two endings — a caller that must paint
something reads the second, a caller whose contract is "no known colour, render
something else" (`teamTintColor`, `teamStripeGradient`, `teamChipColors`) reads
the first. Do not add a third ending.

Until July 2026 there were **two** mechanisms that could not agree: the headshot
tint jumped straight to step 2 and never saw the affiliate (a Durham Bulls
headshot tinted with its parent Rays' colour), while the logo tile read step 1
and had no step 2 at all. Collapsing them is why every MiLB headshot,
`PitcherNotice`, and off-day card now reads as the affiliate's own identity.

`brandColors.js` sits *below* both `teams.js` and `milbColors.js` because
`milbColors.js` already reaches `teams.js` transitively through `wpaLogo.js` —
putting the chain in either one and importing the other closes an import cycle.

An affiliate research never resolved a hex for carries `"found": false` and **no
`pair`**, so it falls to step 2 rather than wearing an invented colour; three do
today (482 Corpus Christi, 553 Knoxville, 1956 Somerset). `milbHasResearchedColor`
is deliberately step-1-only, so the lab still flags a club that is merely
borrowing its org's pair. Methodology and confidence definitions live in
`.scratch/milb-team-colors/README.md`; every per-team caveat lives in the store's
own `note`.

## Where a value lives

| Module | Owns |
| --- | --- |
| `brandColors.js` | `TEAM_COLOR_PAIRS`, `MILB_PARENT_ORG`, the researched MiLB pairs, and **the one affiliate→colour chain** both layers read |
| `teams.js` | Club names/abbreviations/ids, logo URL builders, the MLB-only colour tables (`TEAM_COLORS`, `ALT_COLORS`, `CITY_CONNECT_COLORS`, `ALT2/3/4_COLORS`), and every MLB tile resolver — `treatmentTile` is the one every surface goes through |
| `logoArt.js` | The curated-art standard: the PNG header reader, the rejection reasons, and the treatment→directory allowlist an upload resolves through |
| `milbColors.js` | The MiLB counterpart: the Home/Away resolvers and `milbTreatmentTile` (it re-exports the chain rather than owning it) |
| `wpaLogo.js` | Which mark tiles a win-probability band, its layout geometry, and whether it may be recoloured |
| `wpaBandColors.js` | That band's fill/pinstripe resolution |
| `logoMono.js` | The one-colour knockout marks for navy mastheads (ADR-0031) |

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
| `milb-colors.json` | `brandColors.js` |
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

`milb-colors.json` is the one store with no `treatments` — an affiliate has a
single identity, not a per-treatment one:

```json
{ "546": { "name": "…", "level": "Double-A", "pair": ["#e03a3e", "#003263"],
           "third": "#cbccce", "confidence": "low", "source": "…", "note": "…" } }
```

`pair` is the only field a resolver reads. `third`/`confidence`/`source`/`note`
are provenance, and `found: false` (mutually exclusive with `pair`, enforced by
the dev-save validator and by `test/identity-lab-stores.test.js`) marks a club
research resolved nothing for.

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

## The curated art (`public/team-logos/`)

The mlbstatic CDN carries no alternate or City Connect marks, so each one is
hand-procured art checked into `public/team-logos/{treatment}/{ABBR}.png`.
`logoArt.js` holds the standard those files meet — **512×512, PNG, under
400 KB** — derived from the art already on disk rather than invented.

Drag a PNG onto a tile in `/identity-lab` and it lands there. **The upload
contract**, in one place because PR 4's MiLB art builds directly on it:

| | |
| --- | --- |
| Endpoint | `POST /__dev/team-logo?teamId={id}&treatment={key}`, raw PNG bytes as the body |
| Destination | resolved server-side — directory from `LOGO_TREATMENT_DIRS`, filename from `teamAbbr`. **A request never supplies a path.** |
| Rejected | not a PNG, not exactly 512×512, over the cap — each with the reason, shown inline on the tile |
| Accepted-with-a-note | a PNG carrying no alpha channel (six committed files have none and render fine, so it's said once, not refused) |
| Response | `{ file, url, caveat }` |
| Side effect | `src/lib/data/logo-art.json` is rebuilt from disk |

Validation reads the PNG header by hand — width and height are big-endian
uint32s at bytes 16 and 20 of the IHDR chunk — so there is **no image library
and no new dependency**. The same functions run in the browser (instant, specific
rejection) and in Node (the authoritative check), so the two can't disagree.

Two things that surprise people:

- **`logo-art.json` is a record, not a source.** No resolver reads it;
  `localLogoUrl` still has no whitelist, and a missing file still just 404s and
  degrades. The manifest exists so `test/logo-upload.test.js` can catch a file
  added or deleted by hand — regenerate with `node scripts/gen-logo-art.mjs`.
- **Uploading art doesn't always change the tile.** `teams.js` decides what a
  tile wears, and for a club in one of the `*_USES_BASE_LOGO` sets (plain CDN
  mark), one filed under `ALT_LOGO_SVG`, or a Main tile with no `recolor`
  override, that isn't the uploaded `.png`. The lab says so on the tile after a
  successful upload rather than leaving you staring at an unchanged mark.

Existing `.svg` art stays as it is — the standard governs new uploads.

## `TeamLogo`'s own fallback chain

Curated-art coverage is partial by design (§ above), so the component every
consumer renders through (`src/components/TeamLogo.jsx`) degrades in its own
two steps, independent of the colour chain: a requested `variant` that 404s
retries the plain `base` mlbstatic mark; no id, no base mark, or the base also
failing draws a single-letter monogram. Never a broken-image icon, and asking
for a mark a club happens to lack (the same 8-club City Connect gap PR 2/3
found, or a not-yet-uploaded MiLB side) quietly falls back rather than
erroring. This is orthogonal to `logo-art.json` — the manifest is a record for
`test/logo-upload.test.js`, not something `TeamLogo` consults.

## Club theming (`headerTheme.js`)

The lineup page (`screens/TeamInfo.jsx`) dresses its club-name bar and that
side's section mastheads in the header colours of the jersey the club is wearing
that game — **ADR-0030**. `headerThemeFor(teamId, treatment)` is the one
resolver between the two header tables and that one surface; it answers `null`
for an uncovered pair, and the CSS fallbacks (`var(--bar-fill, var(--navy))`)
keep an unthemed page byte-identical to how it rendered before the feature
existed. Coverage is partial on purpose (67 pairs today) — the resolver never
synthesises a triad, because an unreviewed colour pair on a real page is exactly
what the guard below can't vouch for.

The triad is `{ bar, accent, onBar }`: the bar's fill, its kraft-tape bottom
edge, the ink on it. It was `{ blue, gold, font }` until ADR-0030 — names that
described the *default navy chrome's* own colours and stopped meaning anything
once a club's bar was red.

**`scripts/check-contrast.mjs` asserts `onBar` against `bar` at WCAG AA for
every entry in both stores**, and `test/header-theme.test.js` repeats it. That
guard is what makes a hand-tuned pair safe to ship: nothing else catches a
combination that reads fine to whoever picked it. `accent` is deliberately not
asserted — it's a rule against the page, not text against the bar. Retune a
failing pair; never lower the threshold.

Two things worth knowing before changing any of it:

- **MLB is keyed by treatment, MiLB by game side** — the same split the rest of
  this file keeps. `TeamInfo` picks the key with `isMlbTeamId`; the resolver
  reads whichever table the id belongs to.
- **A themed masthead re-inks its mono club mark** (`filter: brightness(0)` when
  `onBarTone` is dark), because a white knockout vanishes on a light bar. That
  is NOT the filter-whitening ADR-0031 forbids — see ADR-0030's last section for
  why an already-flat silhouette is the one safe case.

## The rule that must not drift

**Theming's only inputs are `(teamId, treatment)`.** Identity, never state. The
tempting future violation is obvious — "tint the page by whoever's leading" —
and it *would* be a spoiler (root `CLAUDE.md`). Nothing in this directory may
read a score, an inning, or a win probability to decide a colour. ADR-0030
records the reasoning; `test/header-theme.test.js` asserts it structurally, so
wiring a feed into `headerTheme.js` fails a test rather than a review.
