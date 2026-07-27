# Team Identity Lab — PRD

Status: complete
Owner: Gary
Planned: 2026-07-27
Completed: 2026-07-27 (PR 7)
Base at planning time: `origin/main` @ `14ae212`

Rework of the unshipped "Team Color Lab" effort (three unlinked dev/QA screens,
~40 commits 2026-07-17→07-24) into one consolidated lab that writes directly to
disk, plus a real user-facing team-theming/uniform feature.

**Read this file first in any fresh context.** Then read
`implementation-log.md` in this directory for what has actually landed. The
per-PR prompts live in `prompts/`.

---

## 1. Verified findings (do not re-derive)

Everything in this section was checked against the code on 2026-07-27, not
assumed. Several contradict the original framing of the effort.

### 1.1 The dev-only write-back mechanism already exists

`vite.config.js:29-84` ships `uniformNamesDevSave()` — a `configureServer`
middleware at `/__dev/uniform-names` that POSTs a validated JSON body straight
to `public/data/uniform-names.json`. Supporting pieces:

- `src/App.jsx:116` gates `UniformNamesPage` behind `import.meta.env.DEV`.
- `src/lib/route.js:125` still parses the route so a stray production hit falls
  through to `home` instead of matching the 3-segment game route.
- `e2e/uniform-names.spec.js` covers the validator (405 / 400 / 413 paths).
- `src/screens/TeamColorLab.jsx:48` already POSTs to it.

**This is a working precedent to generalize, not a design to invent.** Do not
go research Vite's `configureServer` from scratch.

### 1.2 The MiLB colour "merge" is a no-op

Diffed `.scratch/milb-team-colors/milb-colors.json` against
`MILB_RESEARCHED_PAIRS` in `src/lib/milbColors.js`:

| Measure | Value |
| --- | --- |
| Stash entries | 120 |
| Live `MILB_RESEARCHED_PAIRS` | 115 |
| In live but not in stash | 0 |
| **Hex disagreements across the 115 shared** | **0** |

The live table *is* the stash, already landed, minus the 5 deliberately
excluded teams. There is nothing to merge. The real work is the 5 gaps, the
metadata the stash carries that the live table dropped (`third` on 100 of 120,
`confidence`, `source`, `note`), and retiring the stash.

### 1.3 `GAMECARD_TILE_COLORS` / `gameCardTileColor()` are already deleted

Zero hits in `src/`, `scripts/`, `test/`, `e2e/`. The only surviving reference
is `.scratch/gamecard-team-colors/issues/01-solid-tile-colors.md`, which
describes them in the present tense and is now wrong. **Nothing to delete —
the fix is a stale doc.**

### 1.4 `TeamInfo.jsx` is not the team detail page

It is the per-game away/home **lineup staging page**
(`GameView → TeamInfo ×2 → InningViewer`). The club hub is `TeamPage.jsx`, and
it **already has** both things the effort set out to build:

- `JerseyCombos.jsx` (per-jersey uniform strip, real catalog, W-L per jersey) —
  `TeamPage.jsx:876`
- `favoriteAccentColor()` team-colour use — `TeamPage.jsx:856`

The narrower claim holds: `TeamInfo` itself uses zero colour or treatment.

### 1.5 `JERSEY_TREATMENT_OVERRIDES` keys embed the season — latent league-wide bug

All 69 entries in `src/api/uniforms.js` are keyed like `'110_jersey_1_2026'`.
At the 2027 rollover every key goes stale simultaneously and all 69
hand-curated mappings silently fall back to `classifyUniformAsset`'s naming
heuristic. No error, no warning — just wrong logos league-wide.

This is the most important thing the audit view (PR 2) must surface. **A fix is
out of scope for this effort** unless PR 2's audit shows it is already causing
live misapplications; log findings in `implementation-log.md` and raise it.

### 1.6 The `alternate-4` art gap is NOT a bug

`public/team-logos/alternate-4/` does not exist, but all five `ALT4_COLORS`
clubs (141, 119, 135, 140, 111) are also in `ALT4_USES_BASE_LOGO`, so
`localLogoUrl` is never called for that treatment. Correct as written. Do not
"fix" this.

### 1.7 `TEAM_ABBR` is MLB-only

30 entries (`src/lib/teams.js:48`). `teamAbbr()` falls back to a 3-letter slice
of the club name, which collides across MiLB. **MiLB logo art must key on team
id, never abbreviation.**

### 1.8 Existing logo art is already 512×512 PNG

93 of 94 files across `public/team-logos/{alternate,alternate-2,alternate-3,city-connect,main-overrides}/`
are 512×512. Sole outlier: `alternate/TEX.png` at 1280×1280. A few files are
`.svg` (tracked by `ALT_LOGO_SVG` in `teams.js`); those stay as-is.

### 1.9 Other

- `docs/adr/` has a **numbering collision** — two `0025-*` files. Next free
  number is **0029**.
- `src/screens/` is at 40 files, past the flat-directory threshold in root
  `CLAUDE.md`.
- MiLB has no uniform feed. `docs/uniforms-and-logos.md:29` confirms
  `/uniforms/team` returns empty for MiLB. **Hard boundary — do not invent
  per-game MiLB uniform data.**
- `milbTreatmentTile()` hardcodes `logoVariant: 'base'`, so every affiliate
  currently wears the same CDN mark home and away.

---

## 2. Locked decisions

Decided with the owner during planning. **Do not re-litigate.**

1. **Ships as a real user-facing feature**, not just an internal tool.
2. **One consolidated lab**, renamed **Team Identity Lab** at `/identity-lab`,
   in `src/screens/identity-lab/`. It covers colour, logo art, uniform→treatment
   mapping, and WPA pattern. Old routes (`/team-color-lab`,
   `/team-color-lab-{aaa,aa,higha,a}`, `/team-pattern-lab`) are replaced
   outright — they are unlisted and linked from nowhere, so no redirect.
3. **The lab writes to disk**, strictly dev-only. No copy-a-snippet workflow.
4. **Tunable tables move from `.js` into `src/lib/data/*.json`**, statically
   imported. Rationale in §3.
5. **MiLB gets its own colours** ahead of the parent org's in the fallback
   chain (§5). This is a visible change to every MiLB headshot.
6. **Portland Sea Dogs (546)**: resolve the documented two-source navy conflict
   in favour of the red `#e03a3e` already hand-tuned in the lab.
7. **512×512 transparent PNG** is the logo standard (§4).

---

## 3. Architecture — lab framework and write-back

### 3.1 Shared vs. per-dimension

New directory `src/screens/identity-lab/`. Shared scaffolding, extracted from
the near-identical halves of `TeamColorLab.jsx` (1324 lines) and
`MilbTeamColorLab.jsx` (805 lines):

- `LabShell.jsx` — header, hint, dimension/level nav, pinned jump-link sidebar,
  collapse state, the "All changes" export.
- `useDraftStore.js`, `useAutoClearLandedDrafts.js` — the localStorage draft
  layer and the "draft now matches the landed value, clear it" logic. Both
  files carry their own copy today.
- `TeamLabRow.jsx` / `TreatmentBox.jsx`.
- `editors/LogoPositionControls.jsx`, `editors/WpaPreview.jsx` (+ scenarios),
  `editors/HeaderPreview.jsx` — one copy each; duplicated with cosmetic drift
  today.
- `teamAnchorId.js` — one copy. There are three today (`TeamColorLab`,
  `MilbTeamColorLab`, `UniformNamesPage`).

Each lab becomes a **profile descriptor** — a plain object, no class hierarchy:

```js
{ key, title, route, treatments, loadTeams, colorsFor, stores, editors }
```

MLB passes its 6 treatments; MiLB passes `home`/`away`; the pattern view passes
`['wpa']` as its only editor and every level as its team source.

**Deliberately NOT unified:** the treatment sets, `colorsFor` (MLB's triad
resolution vs. MiLB's pair swap), and the MLB-only jersey-catalog/name-editing
panel — MiLB has no uniform catalog endpoint to hang it on. Consolidate the
scaffolding, do not force parity where the data genuinely differs.

### 3.2 Why tables move to JSON

Today's write targets are `.js` source with hand-written per-entry comments.
Rewriting JS source programmatically (AST surgery or regex codegen) is fragile
and is **not** the approach.

Vite bundles a static JSON import synchronously, so no call site changes from
sync to async. The `.js` modules keep all their prose and resolver functions;
only the raw data literal moves.

Stores:

| File | Replaces |
| --- | --- |
| `src/lib/data/mlb-treatment-tuning.json` | `TREATMENT_SCALE`, `TREATMENT_OFFSET_X/Y`, `TREATMENT_PINSTRIPE_COLOR`, `TREATMENT_HEADER_COLOR_OVERRIDES`, `MAIN_OVERRIDES` tunable fields |
| `src/lib/data/milb-treatment-tuning.json` | `MILB_LOGO_POS_OVERRIDES`, `MILB_WPA_LOGO_LAYOUT_OVERRIDES`, `MILB_WPA_BAND_COLOR_OVERRIDES`, `MILB_HEADER_COLOR_OVERRIDES` |
| `src/lib/data/wpa-tuning.json` | `WPA_LOGO_LAYOUT_OVERRIDES`, `BAND_COLOR_OVERRIDES`, `WPA_TREATMENT_BAND_COLOR_OVERRIDES` |
| `src/lib/data/milb-colors.json` | `MILB_RESEARCHED_PAIRS` (+ reconciled metadata, PR 5) |
| `src/lib/data/logo-art.json` | *(new)* coverage manifest, PR 3/4 |

**Per-entry comments survive as data.** Each entry gains `"name"` (replacing the
trailing `// Buffalo Bisons`) and optional `"note"` (the rationale, e.g. *"the C
mark already touches all four edges of its canvas, so the default 1.32
edge-bleed crops it"*). Resolvers ignore both. The lab renders `note` as an
editable field, so rationale is authored in the tool rather than lost on the
first write.

Output format: 2-space pretty-printed, keys sorted by team id, trailing
newline — so `git diff` shows exactly which team/treatment/field moved and
nothing else.

### 3.3 The middleware

`uniformNamesDevSave()` generalizes to `devDataSave()`: one plugin, a **closed
allowlist** of `{ route → file, validator }`. The allowlist is the security
boundary — there must be no path from a request body to an arbitrary
filesystem location. Body-size cap and per-store shape validation carry over
from the existing implementation.

### 3.4 Production isolation — four independent layers

1. `configureServer` only runs under `vite dev` — never `build`, `preview`, or
   Vercel.
2. Every lab screen gated `import.meta.env.DEV` in `App.jsx`. (They ship
   unlisted today; once they have a Save button that is pointless in
   production, they follow `UniformNamesPage`'s precedent.)
3. `route.js` keeps parsing the names so a stray production URL falls through
   to `home`.
4. A post-build check asserting no `/__dev/` string survives into `dist/`,
   wired into the CI `lint-and-build` job.

Recorded as **ADR-0029**.

---

## 4. Logo art pipeline

### 4.1 The standard

Derived empirically from existing art (§1.8), not invented.

| | |
| --- | --- |
| Format | PNG, transparent background |
| Dimensions | exactly 512×512 |
| Size cap | 400 KB (current largest: `city-connect/MIL.png` at 295 KB) |

Validation needs **no image library** — PNG stores width and height as
big-endian uint32 at bytes 16–24 of the IHDR chunk. Reject anything that is not
the PNG magic bytes plus those exact dimensions.

### 4.2 Upload

New dev endpoint `/__dev/team-logo` on the same closed-allowlist middleware.
Validates magic bytes, exact dimensions, size cap; resolves destination from an
allowlist of treatment directories. Drag a PNG onto any tile in the lab and it
writes to `public/team-logos/{treatment}/{ABBR}.png`.

Vite serves `public/` directly in dev, so the write is live immediately; the
tile re-requests with a `?v={counter}` cache-buster.

### 4.3 MiLB home/away art

New directories `public/team-logos/milb-home/` and `milb-away/`, **keyed by
team id** (§1.7). `milbTreatmentTile()` extends to return curated art when it
exists, falling back to today's tinted CDN base mark.

Coverage tracked in `src/lib/data/logo-art.json`, written by the upload
endpoint itself — **not** via `TeamLogo`'s `onError` fallback, which with 120
affiliates × 2 sides would fire hundreds of 404s per page. A unit test asserts
the manifest matches what is on disk, so hand-added/hand-deleted files cannot
drift.

**Scale warning:** 240 files to source and upload by hand. The design degrades
cleanly (no art → today's behaviour), so it is useful from the first file and
full coverage is not expected soon.

---

## 5. MiLB data reconciliation

Build `src/lib/data/milb-colors.json` as the union: the 115 live pairs
unchanged, plus the stash's `third`/`confidence`/`source`/`note`.

The 5 gaps — **do not invent hexes**:

| Team | Action |
| --- | --- |
| 6325 Columbus Clingstones | **Promote.** Lab bg `#f58b6d`/`#000000` closely matches the stash's unverified `#FF8D6D`/`#010101`. |
| 546 Portland Sea Dogs | **Promote** lab bg `#e03a3e`. Resolves the two-source navy conflict toward the sportsfancovers reading — flag `confidence: low`, preserve the conflict note. |
| 482 Corpus Christi, 553 Knoxville, 1956 Somerset | **Stay unresolved.** Their lab bgs are `#FFFFFF`/`#D0D0D0` — the neutral placeholder, not a researched colour. Mark `found: false` so the lab flags them. |

Carry forward the known-bad flags on entries that *are* live: **106 Erie
SeaWolves** (mislabeled source) and **3410 Richmond** (pre-2026 identity).

**Stash retirement:** delete `.scratch/milb-team-colors/milb-colors.json`; keep
a short `README.md` stub pointing at the new file and preserving the
methodology and confidence-level definitions.

### 5.1 Fallback collapse

One function, one explicit chain, shared by both paths:

```
milbColorPair(teamId)
  1. own researched pair            (milb-colors.json)
  2. parent org's TEAM_COLOR_PAIRS  (via MILB_PARENT_ORG)
  3. NEUTRAL_FALLBACK_PAIR
```

`MILB_PARENT_ORG` **stays** — it is script-generated and step 2 needs it. What
collapses is the resolution logic, not the data.

⚠️ **Visible behaviour change.** Today `teamTintColor` jumps straight to the
parent org and never sees the affiliate's own colour — a Durham Bulls headshot
currently tints Rays navy. After this it tints Bulls blue. This changes every
MiLB headshot, `PitcherNotice`, and `OffDaySection` in the app. Verify on a dev
server against a real MiLB game before opening the PR.

---

## 6. Theming and uniform display

- **Uniform sets → `TeamPage`**, extending the existing `JerseyCombos`. Not a
  new component on `TeamInfo`. MLB already works. MiLB gets a two-card
  Home/Away strip from `milbTreatmentTile` in a `variant="static"` mode, **with
  no W-L record** — there is no per-game MiLB jersey feed to attribute games to
  (§1.9).
- **Theming → `TeamInfo`**, the genuinely new surface. Theme the
  `.teaminfo__head` club-name bar and that side's `SectionMasthead` bars with
  the header colours for the jersey the club is actually wearing
  (`jerseyTreatmentFor` → `defaultTreatmentFor` → the header table). Payoff: the
  away and home pages become visually distinct in a flow where you page through
  both.
- **Header colour shape is revised now.** `{ blue, gold, font }` names the
  *default navy chrome's* colours, which stops making sense once a club's bar is
  red. Rename to semantic `{ bar, accent, onBar }`, and extend
  `scripts/check-contrast.mjs` to assert `onBar` against `bar` at WCAG AA for
  **every entry in the store**. That guard is what makes this shippable as a
  real feature rather than a lab preview. Coverage is partial, so the resolver
  falls back to default navy chrome and the lab shows coverage explicitly.
- **Scope discipline:** `TeamInfo` only. Not the innings viewer, not the box
  score — those carry the seal metaphor (kraft amber on manila) and recolouring
  them would fight the spoiler UI's own visual language.

---

## 7. Spoiler analysis

The app's core invariant (root `CLAUDE.md`). Argued, not assumed:

- **Uniform, logo, and colour data is identity, not state.** Every input is a
  static per-club table, `public/data/jerseys.json`
  (`gamePk:teamId → treatment *name*`), or the uniform catalog. None carries
  runs, hits, errors, innings, outs, or win probability. A colour cannot encode
  a score.
- **Theming's only inputs are `(teamId, treatment)`.** Written as an explicit
  invariant in ADR-0030 and `src/lib/CLAUDE.md`, because the tempting future
  violation is obvious — "tint the page by whoever's leading" *would* be a
  spoiler, and the rule needs writing down before someone proposes it.
- **`jerseyTreatmentFor` is already unsealed** on the slate and in-game
  masthead. Knowing a club wore City Connect tells you nothing about the result.
- **The one place uniform data touches a result** is `buildJerseyCombos`'s
  per-jersey W-L, already gated by the schedule cutoff. This effort does not
  touch that gate, and the new MiLB strip carries no record at all — zero added
  exposure.
- **WPA pattern work touches `WinProbChart`**, which *is* inside the box-score
  seal — but only its band colours and logo tiling. No selector, no reveal gate,
  no data path changes.

---

## 8. PR sequence

Ordered on one principle: **audit before you invest.** Knowing which mappings
are wrong comes before re-uploading art or reconciling colour, because it may
change what that work should be.

| PR | Scope | Visible change |
| --- | --- | --- |
| **1** | Framework consolidation, tables → JSON, `devDataSave()` allowlist, DEV-gating, `dist/` guard, ADR-0029 | None |
| **2** | Jersey audit view + hex copy/paste + season-staleness flag | Lab only |
| **3** | Logo upload pipeline (MLB), 512×512 standard, `logo-art.json`, TEX downscale | Lab only |
| **4** | MiLB home/away logo support — schema, rendering, upload wired. Ships with zero art. | Lab only |
| **5** | MiLB colour reconciliation, unified fallback chain, stash retired | **Yes** — MiLB headshot tints |
| **6** | Uniform-set display + `TeamInfo` theming + contrast guard + ADR-0030 | **Yes** — the feature |
| **7** | Docs, ADR-0025 collision, stale scratch doc, `src/lib/CLAUDE.md` | None |

Each PR carries its own doc and test updates (repo convention: product code and
its tests land together). PR 7 is cleanup only, not a docs dumping ground.

---

## 9. Standing rules for every PR

- **Branch + PR always. Never push to `main`, never trigger a Vercel deploy.**
- Work in a **fresh worktree** off current `origin/main`:
  `git worktree add ../bbsbh-<slug> -b claude/<slug> origin/main`.
  A PreToolUse hook blocks edits in the primary checkout.
- Fetch and inventory worktrees/open PRs before choosing a base. These PRs are
  **sequential** — each bases on `origin/main` after the previous has merged.
  If the previous has not merged, base on its branch and say so in the PR body.
- `npm run lint && npm test` must pass before opening a PR.
- For any user-visible change, start a dev server on a free reserved port
  (`npm run dev` 5173, or `dev:2..5` → 5172-5169), verify the exact changed
  route, and put the clickable local URL in the handoff. **Append `?nointro`.**
- Never delete, skip, or loosen a test to make CI pass.
- **Append a section to `implementation-log.md` before opening the PR.** That
  file is how the next context recovers state.
