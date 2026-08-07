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
`milbColors.js` already reaches `teams.js` directly (`teamLogoUrl`) — putting the
chain in either one and importing the other closes an import cycle. (That reach
used to be described as transitive, through `wpaLogo.js`; it is a direct import
now that `milbColors.js` takes its two WPA constants from `wpa/wpaDefaults.js`
instead. The cycle argument is unchanged.)

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
| `teams.js` | Club names/abbreviations/ids, logo URL builders, the MLB-only colour tables (`TEAM_COLORS` — the distinctiveness accent — plus `teamColorExtras`, `ALT_COLORS`, `CITY_CONNECT_COLORS`, `ALT2/3/4_COLORS`), and every MLB tile resolver — `treatmentTile` is the one every surface goes through |
| `logoArt.js` | The curated-art standard: the PNG header reader, the rejection reasons, and the treatment→directory allowlist an upload resolves through |
| `milbColors.js` | The MiLB counterpart: the Home/Away resolvers and `milbTreatmentTile` (it re-exports the chain rather than owning it) |
| `wpa/wpaLogo.js` | Which mark tiles a win-probability band, its layout geometry, and whether it may be recoloured |
| `wpa/wpaBandColors.js` | That band's fill/pinstripe resolution |
| `wpa/wpaDefaults.js` | The two WPA constants a **non-WPA** caller needs, in a dependency-free leaf. `milbColors.js` is on the eager first-paint path, so importing them from their home modules dragged `data/wpa-tuning.json` into the entry chunk (−3.7 KB gz once split out). Keep it import-free |
| `logoMono.js` | The one-colour knockout marks for navy mastheads (ADR-0031) |
| `monoInk.js` | The hand-picked per-SHAPE corrections to that conversion (`data/mono-ink.json`) |
| `stampLogoTuning.js` | Where that knockout mark sits inside a Logbook stamp's mark slot, per side (`data/stamp-logo-tuning.json`, ADR-0035's amendment) |
| `stampInk.js` | Which colour a Logbook stamp is pressed in — the WINNING club's darkest brand colour, floored for contrast against the page's paper (ADR-0036's second addendum). The one module here that reads game state; see "The rule that must not drift" below |
| `logoRecolor.js` | Repainting individual shapes in full color — how a club's missing jersey art gets built |
| `customMarks.js` | The library of those recolored marks, and which treatment wears one — plus each BAR's own pasted-SVG masthead mark (Main, City Connect, MiLB's one bar), under synthetic keys (`data/custom-marks.json`; ADR-0031's addendum) |

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
| `mlb-team-colors.json` | `brandColors.js`, `teams.js` |
| `mono-ink.json` | `monoInk.js` — and `scripts/gen-mono-logos.mjs`, which is what it actually changes |
| `stamp-logo-tuning.json` | `stampLogoTuning.js` → `components/GameStamp.jsx` — the one store read at RENDER time |
| `wpa-tuning.json` | `wpa/wpaLogo.js`, `wpa/wpaBandColors.js` — deliberately NOT reachable from the eager entry graph; see `wpa/wpaDefaults.js` |

Every store has the same outer shape:

```json
{ "<teamId>": { "name": "…", "treatments": { "<key>": { …fields, "note": "…" } } } }
```

`name` and `note` are the per-entry comments these tables carried as literals,
kept as data so a 900-line JSON diff still says which club moved and why a value
is odd. **No resolver reads either one** — they exist for humans, and the lab
renders `note` as an editable field so rationale is authored in the tool rather
than lost on the first write.

**Two stores have no `treatments`** — they hold a fact about the CLUB, not about
one of its jersey treatments. `test/identity-lab-stores.test.js` keeps them in
its `TEAM_LEVEL_STORES` list so they still get every outer-shape guard.

`milb-colors.json` — an affiliate has a single identity, not a per-treatment one:

```json
{ "546": { "name": "…", "level": "Double-A", "pair": ["#e03a3e", "#003263"],
           "third": "#cbccce", "confidence": "low", "source": "…", "note": "…" } }
```

`mlb-team-colors.json` — a club's brand colours, the store behind
`TEAM_COLOR_PAIRS`, `TEAM_COLORS`, and `teamColorExtras`, plus the club-level
(not per-treatment) `offDayTreatment` pick `offDayTreatmentFor` reads for
`OffDaySection.jsx`'s tile — absent means Main — and the same idea per side,
`defaultHomeTreatment`/`defaultAwayTreatment` (`defaultHomeTreatmentFor`/
`defaultAwayTreatmentFor`), which `defaultTreatmentFor` consults before its own
Friday/City-Connect heuristic — absent means "guess" rather than "Main":

```json
{ "158": { "name": "…", "primary": "#12284B", "secondary": "#FFC52F",
           "accent": "#FFC52F", "offDayTreatment": "alternate",
           "defaultHomeTreatment": "city-connect", "defaultAwayTreatment": "main",
           "extras": [{ "label": "Powder Blue", "hex": "#6CACE4" }], "note": "…" } }
```

**`accent` is not a third brand colour**, and conflating the two is the mistake
this schema exists to prevent. It is the hand-picked *distinctiveness* hex — the
one that makes two clubs on a slate card tell apart — so for 27 of 30 clubs it
deliberately restates that club's own `primary` or `secondary`, and only the
Guardians, Rays, and Blue Jays carry a hue the pair doesn't. A club's real
third-or-later colours are `extras`, researched against Wikipedia infoboxes and
teamcolorcodes.com and skipped rather than guessed where sources disagreed (14
clubs have one). Every colour field is optional; **a role the club lacks is an
absent field, never `""`** — the dev-save validator rejects the empty string, and
the lab's `applyColorsDraft` deletes rather than blanks
(`src/screens/identity-lab/profiles/mlbColorRoles.js`).

In `milb-colors.json`, `pair` is the only field a resolver reads. `third`/`confidence`/`source`/`note`
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

## Stamp placement (`stampLogoTuning.js` + `data/stamp-logo-tuning.json`)

The Logbook stamp letterboxes each club's knockout mark into one 150×150 slot
(`lib/stampArt.js`'s `MARK_BOX`). One slot has to hold a portrait cap logo, a
square roundel and a wide wordmark, so a club may carry
`{ scale, offsetX, offsetY, rotation }` — picked by eye in `/identity-lab`'s
**Stamp placement** editor, which previews the real stamp for both slots.

Keyed per club and then per SIDE (`away`/`home`, the MiLB vocabulary), because
the two slots are not mirror images: each bleeds off the opposite edge of the
clip circle, so the nudge that rescues one can ruin the other. MLB and every
MiLB level read the same store — it is keyed by team id and knows nothing about
levels.

Three things to know before touching it, all recorded in ADR-0035's amendment:

- **It is read at RENDER time, and it is retroactive.** Every other store here
  feeds a resolver or a generator; this one is consulted each time a stamp
  draws. A stamp keeps game facts and no art, so retuning a club restyles that
  club's stamps everywhere on the next deploy — including keepsakes already
  minted and placed in someone's passport book. That is the design, not a leak:
  one club, one placement.
- **Untuned means untouched.** `markTransform` answers `null` rather than an
  identity transform, so a club with no entry emits the markup the locked design
  shipped with. `test/stamp-art.test.js` pins it.
- **The four fields clamp in three places** — the editor's inputs,
  `resolveMarkPlacement`, and the dev-save validator. Given the blast radius, a
  typo may shift a mark and never fling it off the stamp.

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

A sibling endpoint reuses one already-uploaded mark on another of the same
club's treatments instead of procuring/uploading it again — the lab's "Copy
here" control next to Replace art on every tile: `POST
/__dev/team-logo-copy?teamId={id}&from={key}&to={key}`, no body — the bytes
travel server-side, read off whatever `from` already has on disk, and land
through the exact same validate/write/rebuild-the-manifest path as a real
upload. Same response shape, plus a 404 (`no art uploaded for "{from}" yet`)
when the source tile is itself empty.

Validation reads the PNG header by hand — width and height are big-endian
uint32s at bytes 16 and 20 of the IHDR chunk — so there is **no image library
and no new dependency**. The same functions run in the browser (instant, specific
rejection) and in Node (the authoritative check), so the two can't disagree.

Two things that surprise people:

- **`logo-art.json` is a source for Main, a record for everything else.**
  `localLogoUrl` (alternates/City Connect) still has no whitelist and reads
  nothing from the manifest — a missing file just 404s and degrades, same as
  always. Main is the one exception: `mainOverrideLogoUrl`/
  `mainTreatmentRecolor` (teams.js) read the manifest directly, so an upload to
  `main-overrides/` takes effect immediately, with no companion `recolor` flag
  or code change needed — see below. For every other treatment the manifest
  stays a record only, kept so `test/logo-upload.test.js` can catch a file
  added or deleted by hand — regenerate with `node scripts/gen-logo-art.mjs`.
- **Uploading art doesn't always change the tile.** `teams.js` decides what a
  tile wears, and for a club in one of the `*_USES_BASE_LOGO` sets (plain CDN
  mark, including the two Main-only exceptions in `MAIN_USES_BASE_LOGO` —
  Rockies/Yankees, whose pinstripe tile keeps the stock CDN mark even though a
  legacy `main-overrides` file for them sits unused on disk) or one filed under
  `ALT_LOGO_SVG`, that isn't the uploaded `.png`. The lab says so on the tile
  after a successful upload rather than leaving you staring at an unchanged
  mark.

Existing `.svg` art stays as it is — the standard governs new uploads.

## Recolored marks (`customMarks.js` + `data/custom-marks.json`)

Uploading isn't the only way a treatment gets a mark. The CDN carries no
alternate or City Connect art, and the real thing is often the SAME shapes in
another palette — so `/identity-lab`'s **Logo art** editor recolors a source
mark shape by shape (`logoRecolor.js`, sharing `logoMono.js`'s shape numbering
so a shape means one thing in both editors) and saves the result to the club's
library under a name.

Two rules make this safe to use on a club whose art someone already procured:

- **Saving never overwrites.** A name already in the library is refused with a
  409; there is no merge and no silent rename.
- **Wearing one is an ASSIGNMENT, not a copy.** `assignments` maps a treatment
  to a library slug, and `localLogoUrl`/`mainOverrideLogoUrl` read it *first*.
  The curated PNG that treatment had is untouched on disk, and picking "Original
  art" in the Replace-art select hands it straight back. The alternative —
  copying the SVG into `public/team-logos/{treatment}/` — would either shadow
  that file or require deleting it, and `ALT_LOGO_SVG` would have needed a code
  edit per assignment besides.

Both halves are written server-side only (`scripts/lib/dev-custom-marks.mjs`),
because the library is derived from what's actually in
`public/team-logos/custom/` and two writers is how a manifest starts lying.

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

**`variant: 'base'` (the default, and every bare `<TeamLogo>`) is intentionally
override-blind.** `teamLogoUrl`'s `'base'` branch returns the plain mlbstatic CDN
mark before any of the override branches above run, so nothing tuned in
`/identity-lab` — a Main recolor, a custom-mark assignment, a treatment's
scale/tint — reaches a decorative logo (standings, leaders, player/team bios,
headshot fallbacks). That's correct, not a gap: those surfaces carry no
jersey/treatment context for an override to key into. Only `TeamTreatmentMark`
(routes through `treatmentTile`/`milbTreatmentTile`), the WPA resolvers
(`wpaLogoFor`/`wpaLogoWithFallback`), and `variant="mono"` sites reflect Lab
tuning. `LogoModal.jsx`'s sketch view is *mostly* the same story on purpose — it cycles
the CDN's own `cap`/`base`/`wordmark` vectors for reference and says so in its
caption, rather than showing the tuned tile. Its one lab-fed entry is City
Connect, which has no CDN mark at all: `markSources.js`'s `sketchMarkVariants`
offers that tab only for a club whose CC art exists (a procured file, or a
recolor assigned to the treatment), so the mark it draws is the lab's — but
still the mark alone, never the tinted tile.

## Club theming (`headerTheme.js`)

The lineup page (`screens/TeamInfo.jsx`) dresses its club-name bar and that
side's section mastheads in the header colours of the jersey the club is wearing
that game — **ADR-0030**. `headerThemeFor(teamId, treatment)` is the one
resolver between the two header tables and that one surface; it answers `null`
for an uncovered pair, and the CSS fallbacks (`var(--bar-fill, var(--navy))`)
keep an unthemed page byte-identical to how it rendered before the feature
existed. Coverage is partial on purpose (71 pairs today) — the resolver never
synthesises a triad, because an unreviewed colour pair on a real page is exactly
what the guard below can't vouch for.

Both vocabularies collapse several jerseys onto fewer bars, for different
reasons: MLB's `treatmentHeaderColorOverride` (`teams.js`) sends every
treatment but City Connect to the club's shared Main bar — a real Main/City-
Connect asymmetry. MiLB's `milbHeaderColorOverride` (`milbColors.js`) sends
*both* Home and Away to the same slot — there's no such asymmetry to justify
two, unlike Position/WPA, which still tune independently per side.

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

**`stampInk.js` is the single, contained exception**, and knowing exactly why
is what keeps it from becoming a precedent. It reads one thing about a game —
who won — to ink a Logbook stamp. The rule above is about surfaces the user has
NOT revealed; a stamp exists only for a game its owner already finished
revealing (ADR-0035), and it prints that game's final score in numerals, so the
ink is not telling anyone anything. It is safe because of WHERE it can render,
not because of what it computes: its only caller is `GameStamp.jsx`, and that
component's import sites are an allowlist enforced by
`scripts/check-stamp-surfaces.mjs`. **Importing it anywhere else is a spoiler
bug**, not a style choice.
