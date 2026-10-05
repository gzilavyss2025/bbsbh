# src/lib — the colour, logo, and identity data model

Pure data and pure functions, no React. This file covers the **club identity
layer**: which colours a club owns, which mark a tile wears, and how a
hand-tuned adjustment gets from someone's eye into the app. Other modules document
themselves at their tops; `math/` holds the shared pure helpers, `scorecard/` the scorecard
lens's (#724). Share a pure helper. Keep a copy only when it carries a comment that says
why (owner decision 2026-09-30, #1306). Screens: `src/CLAUDE.md`; data: `src/api/CLAUDE.md`.

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
the first. Do not add a third ending: two chains once disagreed about an
affiliate's colour.

`brandColors.js` sits *below* both `teams.js` and `milbColors.js` because
`milbColors.js` already reaches `teams.js` directly (`teamLogoUrl`) — putting the
chain in either one and importing the other closes an import cycle.

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
| `stampInkTuning.js` | A club's hand-picked stamp ink (`data/stamp-ink.json`), read at RENDER time like `stampLogoTuning.js`, so a retune restyles every stamp already minted |
| `stampInk.js` | Which colour a Logbook stamp is pressed in — the WINNING club's darkest brand colour (or the `stampInkTuning.js` pick), floored for contrast against the page's paper (ADR-0036's second addendum). The one module here that reads game state; see "The rule that must not drift" below |
| `logoRecolor.js` | Repainting individual shapes in full color — how a club's missing jersey art gets built |
| `customMarks.js` | The library of those recolored marks, and which treatment wears one — plus each BAR's own pasted-SVG masthead mark (Main, City Connect, MiLB's one bar), under synthetic keys (`data/custom-marks.json`; ADR-0031's addendum) |

`treatmentTile(teamId, treatment)` is the single resolver behind the slate card
(`GameCard`), the in-game masthead (`GameView`), and the lab's own grid — a club
whose mark needs a scale-down or a recolour to read against its own fill needs it
in all three, so there is one answer, not three.

## The hand-tuned stores (`src/lib/data/*.json`)

Store schemas, the reader table, and the colour-field rules: `src/lib/data/CLAUDE.md`.

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

## Editing a value — two paths, one set of stores

Two ways to edit a stored value (the lab and the team hub gear): `docs/identity-lab.md`.

## Stamp placement (`stampLogoTuning.js` + `data/stamp-logo-tuning.json`)

The stamp art is locked and lives as pure math in `lib/stampArt.js`, with one tunable
part. The Logbook stamp letterboxes each club's knockout mark into one 150×150 slot
(`lib/stampArt.js`'s `MARK_BOX`). One slot has to hold a portrait cap logo, a
square roundel and a wide wordmark, so a club may carry
`{ scale, offsetX, offsetY, rotation }` — picked by eye in `/identity-lab`'s
**Stamp placement** editor, which previews the real stamp for both slots.

Keyed per club and then per SIDE (`away`/`home`, the MiLB vocabulary), because
the two slots are not mirror images: each bleeds off the opposite edge of the
clip circle, so the nudge that rescues one can ruin the other. MLB and every
MiLB level read the same store — it is keyed by team id and knows nothing about
levels.

`components/logbook/GameStamp.jsx` draws it. `StampPlacementEditor.jsx` is the fifth of six
names on that component's allowlist in `scripts/check-stamp-surfaces.mjs`, and the only
one whose game is a fabricated literal.

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

Upload contract and validation: `docs/identity-lab.md`.

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

How a recolored mark gets made: `docs/identity-lab.md`.

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

## `TeamLogo` — the base variant is override-blind

`TeamLogo`'s own fallback chain (a 404 retries the base mark, then a monogram): `docs/identity-lab.md`.

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
existed. Coverage is partial on purpose (73 pairs today) — the resolver never
synthesises a triad, because an unreviewed colour pair on a real page is exactly
what the guard below can't vouch for.

Both vocabularies collapse several jerseys onto fewer bars, for different
reasons: MLB's `treatmentHeaderColorOverride` (`teams.js`) sends every
treatment but City Connect to the club's shared Main bar — a real Main/City-
Connect asymmetry. MiLB's `milbHeaderColorOverride` (`milbColors.js`) sends
*both* Home and Away to the same slot — there's no such asymmetry to justify
two, unlike Position/WPA, which still tune independently per side.

The triad is `{ bar, accent, onBar }`: the bar's fill, its kraft-tape bottom
edge, the ink on it. (Renamed from `{ blue, gold, font }` in ADR-0030: those named the default navy chrome.)

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
not because of what it computes: its callers are `GameStamp.jsx` and the lab's `StampPlacementEditor.jsx`, and
that component's import sites are an allowlist enforced by
`scripts/check-stamp-surfaces.mjs`. **Importing it anywhere else is a spoiler
bug**, not a style choice.
