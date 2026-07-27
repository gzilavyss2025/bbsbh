# Implementation log — Team Identity Lab

**This file is how a fresh context recovers state.** Read `PRD.md` first for the
plan, then this file for what has actually landed.

Every PR appends a section here **before** opening the PR. Do not rewrite
earlier sections — append.

## Status board

| PR | Title | Status | Branch | PR # |
| --- | --- | --- | --- | --- |
| 0 | Plan + handoff docs | **merged?** | `claude/team-identity-lab-plan` | — |
| 1 | Lab framework + JSON stores + write-back | **merged** | `claude/identity-lab-framework` | #416 |
| 2 | Jersey audit view + hex copy/paste | **merged** | `claude/jersey-audit-hex-copy` | #418 |
| 3 | Logo upload pipeline (MLB) | **merged** | `claude/logo-upload-pipeline` | #419 |
| 4 | MiLB home/away logo art | **merged** | `claude/milb-logo-art` | #420 |
| 5 | MiLB colour reconciliation | **merged** | `claude/milb-color-reconciliation` | #421 |
| 6 | Theming + uniform display | **merged** | `claude/team-theming-uniforms` | #423 |
| 7 | Docs + cleanup | **merged** | `claude/identity-lab-docs` | — |

Update the row **and** append a section below when a PR opens or merges.

---

## Open questions / decisions still owed by the owner

- None outstanding. The two judgement calls (MiLB tint change, Portland Sea
  Dogs navy) were approved during planning — see `PRD.md` §2 items 5 and 6.

## Things deliberately left alone

- **`JERSEY_TREATMENT_OVERRIDES` season-key staleness** (`PRD.md` §1.5). A real
  latent bug, out of scope. PR 2 surfaces it; if the audit shows it is already
  causing live misapplications, raise it with the owner rather than fixing it
  inline.
- **`alternate-4` has no art directory** — verified correct, not a bug
  (`PRD.md` §1.6). Do not "fix".
- **`MILB_PARENT_ORG`** stays. It is script-generated and the fallback chain
  needs it (`PRD.md` §5.1).

---

## PR 0 — Plan + handoff docs

Landed the PRD, this log, and the seven per-PR prompts under
`.scratch/team-identity-lab/`. No source changes.

Findings that contradicted the original framing are recorded in `PRD.md` §1 —
the write-back mechanism already existed, the MiLB colour "merge" is a no-op
(0 hex disagreements across 115 shared entries), `GAMECARD_TILE_COLORS` was
already deleted, and `TeamInfo` is the lineup page rather than the club hub.

---

## PR 1 — Lab framework, JSON stores, and dev write-back

Branch: `claude/identity-lab-framework` · PR: #416 · Merged: open

Based on `origin/main` @ `8064f11` (PR 0 had already merged as #414).

### What landed

**One lab.** `src/screens/TeamColorLab.jsx` (1324 lines),
`MilbTeamColorLab.jsx` (805) and `TeamPatternLab.jsx` (225) became
`src/screens/identity-lab/` — one shell, one draft store, one auto-clear sweep,
one copy of each editor, one `teamAnchorId`. Each old screen is now a **profile
descriptor** (`profiles/mlb.jsx`, `profiles/milb.jsx` ×4 levels,
`profiles/pattern.jsx`); `ColorLabBody` drives the two colour dimensions off it.
The treatment sets, `colorsFor`, and MLB's jersey-catalog panel stayed
per-dimension, per PRD §3.1.

**One route.** `/identity-lab` replaces `/team-color-lab`,
`/team-color-lab-{aaa,aa,higha,a}` and `/team-pattern-lab` outright — no
redirect (they were unlisted and linked from nowhere). Dimension switching is
an in-page nav, remembered in `localStorage`.

**Tables → JSON.** `src/lib/data/{mlb-treatment-tuning,milb-treatment-tuning,wpa-tuning,milb-colors}.json`,
statically imported. Every `.js` module kept its prose and every resolver, and
now rebuilds the same lookup tables via `src/lib/tuningStore.js`. The
lab's page-local `TREATMENT_OFFSET_X/Y` and `TREATMENT_ORIGIN_Y` moved into the
MLB store behind new `treatmentOffsetX/Y`/`treatmentOriginY` resolvers.

**`devDataSave()`.** `uniformNamesDevSave()` generalized to one plugin over a
closed allowlist (`scripts/lib/dev-data-stores.mjs`), mounted at `/__dev/{key}`.
A request supplies a key, never a path. Wired to the lab's Save.

**Isolation.** Both curation screens (`/identity-lab`, `/uniform-names`) are
DEV-gated in `App.jsx`; `route.js` still parses both names;
`scripts/check-dist-dev-routes.mjs` runs in CI after `npm run build`. Recorded as
**ADR-0029**; `src/lib/CLAUDE.md` started, pointer added from `src/CLAUDE.md`.

### Deviations from the PRD

- **PRD §3.4 item 2 says "every lab screen" is DEV-gated.** Read as the screens
  this PR touches — the two with a Save button. `/animation-lab`,
  `/wordmark-lab` and `/game-notes-debug` still ship unlisted: they carry no
  save path, and gating them would remove pages the owner uses on the deployed
  site. Raise it if that was meant more broadly.
- **`milb-colors.json` landed here**, not in PR 5. §3.2's store table lists it,
  and it was a pure data move; PR 5 still owns the reconciliation (the
  `third`/`confidence`/`source`/`found` metadata, the 5 gaps, the fallback
  chain, retiring the stash). Its entries carry `name`/`level`/`pair` today.
- **Not pixel-identical in two places, both deliberate.** The shell gained a
  dimension nav (unavoidable — five routes became one; it reuses the MiLB
  screen's existing `.patternlab__filters` markup), and every copy snippet now
  names the JSON path instead of the old JS table. The tiles themselves are
  unchanged, verified below.
- **`MILB_COLOR_LAB_LEVELS[].routeName` deleted** — dead once the four routes
  collapsed into profiles.
- **`.milballchanges` CSS deleted**, folded into `.colorlab__allchanges`; the two
  rule sets were byte-identical in effect.
- **`eslint.config.js` moved to `ecmaVersion: 2025`** for `src/**` and
  `scripts/**`. Plain Node requires `with { type: 'json' }` on the new imports
  (the unit suite imports these modules directly) and eslint 2023 can't parse it.
- The three profile files carry a documented
  `eslint-disable react-refresh/only-export-components` — a profile module's
  public surface is its descriptor, not the components inside it.

### What Save writes, and what it doesn't

Save lands scale/offsets, WPA layout + band, header triads, MiLB position
records, and the uniform-name map. It does **not** write a flat background hex
for a non-Main MLB treatment — that lands in `ALT_COLORS`/`CITY_CONNECT_COLORS`,
still JS literals until PR 5 — so those keep their copy-snippet path. Called out
in the lab's own hint text and in `src/lib/CLAUDE.md`.

### Verification

- `npm run lint` clean; `npm test` 766 pass (was 734 — 31 new across
  `test/dev-data-stores.test.js`, `test/identity-lab-stores.test.js`, and the
  retired-route fall-through in `test/route.test.js`).
- **The data move was proved, not eyeballed.** A throwaway script imported the
  pre-change modules alongside the post-change ones and asserted deep equality of
  all 9 rebuilt tables plus every resolver across 180 MLB (team, treatment) cells
  and 240 MiLB (team, variant) cells. All identical.
- **Tiles compared before/after** by screenshot at `/team-color-lab`,
  `/team-color-lab-aaa` and `/team-pattern-lab` vs. `/identity-lab` — same
  dimensions, same values, same charts.
- **Consumers checked live**: slate `GameCard` tiles, the `GameView` masthead,
  and `WinProbChart` (via the lab's real-chart scenario mockups).
- **Write-back exercised end to end**: POSTing a store back to itself is a
  byte-identical round trip; an unknown key or a traversal-shaped key 404s; a bad
  body 400s with a reason; GET 405s. A real UI Save of one Scale field landed
  exactly that field, note last, everything else untouched (then reverted).
- `npm run build` + `npm run check:dist-dev`: the only lab string in `dist/` is
  the route name from isolation layer 3. Confirmed the guard fails when a
  `/__dev` string is planted.
- Dev server: <http://localhost:5171/identity-lab?nointro>

### Notes for the next PR

- PR 2's audit view slots into `profiles/mlb.jsx`; the jersey-match plumbing
  (`jerseyMatchesFor`) it needs is already there.
- `JERSEY_TREATMENT_OVERRIDES`' season-key staleness (PRD §1.5) was left alone as
  instructed and is still unfixed.
- The stores are untracked-new files, so `git diff` won't show a Save's effect
  until this PR merges — use `git status` / a copy while iterating.
- PR 6 renames the header triad to `{ bar, accent, onBar }`; it is still
  `{ blue, gold, font }` everywhere, including the store.

---

## PR 2 — Jersey audit view, season-staleness banner, hex copy/paste

Branch: `claude/jersey-audit-hex-copy` · PR: #420 · Merged: open

Based on `origin/main` @ `4388da1` (PR 1 had already merged as #416).

### What landed

**A new `/identity-lab` tab, "Jersey audit"** (`profiles/audit.jsx`, added right
after MLB in the profile list). Read-only, no draft, no Save. One row per MLB
catalog jersey (148 rows across 30 clubs): the raw `uniformAssetText` /
`uniformAssetCode` verbatim, `jerseyLabel`'s trimmed display label, the
resolved treatment (`classifyUniformAsset`), whether that came from a
`JERSEY_TREATMENT_OVERRIDES` entry or the naming heuristic, and — this is the
part PR 1's own `MlbTile` doesn't give you — the tile **production** actually
renders, via `treatmentTile` + `teamLogoUrl` (the exact resolver `GameCard`/
`GameView` call), not the lab's own editable draft-preview math. A "heuristic
only" checkbox filters to the 79 unaudited rows. A season-staleness banner
above the table counts how many of the 69 `JERSEY_TREATMENT_OVERRIDES` keys
end in the current season (all 69, today) from the static table alone, so it
reads true before the catalog fetch even resolves.

**Hex copy/paste**, lab-wide (`TreatmentBox.jsx`, `hexClipboard.js`, both MLB
and MiLB dimensions since they share `TreatmentBox`): every color chip is now
also a "copy this hex" button (on top of MLB's existing "use as WPA band"
click, not instead of it), and each tile's label row gained a Copy/Paste
palette pair moving `{ bar, accent, onBar, bg, pinstripe }` — the header triad
plus the tile's own fill/pinstripe state — between tiles. The clipboard lives
in localStorage (`bbsbh:identity-lab:clipboard:{hex,palette}`) plus a same-tab
pub/sub (localStorage's own `storage` event only fires cross-tab), so it
survives switching dimensions — `IdentityLab` remounts every profile's `Body`
on switch, but the clipboard itself isn't profile state. Paste only ever
writes through `position.onField`/`header.onField` into the existing draft
layer — never straight to a store — so it's reviewable/Reset-able exactly like
a hand-typed edit.

### Deviations from the PRD

- **Palette clipboard field names are the semantic `{ bar, accent, onBar }`
  PR 6 doesn't land until later** — the store itself is still
  `{ blue, gold, font }` today. Since the clipboard is an ephemeral in-page
  value (never written to a JSON store), there's no migration cost to naming
  it for where the feature is headed rather than where the store currently is;
  `TreatmentBox` maps between the two at the paste boundary.
- **Found and fixed a bug in this PR's own audit tile before it shipped**: the
  first pass used `loading="lazy"` on the rendered-tile `<img>`, so an
  off-screen row's art status read "Curated" (the `failed` flag defaults
  false) before the browser had even attempted the fetch — only correct once
  scrolled into view. Switched to eager loading; a few hundred eager image
  requests is an acceptable cost for a dev-only, unlisted page whose entire
  point is an accurate per-row status.

### Verification

- `npm run lint && npm test && npm run build && npm run check:dist-dev` all
  pass (766 tests, unchanged — no new pure-logic module, so no new unit tests).
- Playwright-driven checks against a live dev server (no `npm run e2e` spec
  added — this is a one-off UI verification, not a regression the CI-gated
  suite needs to pin): the audit table renders 148 rows with the season
  banner, no console errors; a swatch click writes the hex to both the system
  clipboard and `localStorage`; copying one tile's palette and pasting into a
  different team's different treatment actually changed that tile's Blue
  field (confirmed a real cross-team value change, not a same-value
  coincidence); the MiLB dimension renders the same Copy/Paste buttons with no
  errors.
- Dev server: <http://localhost:5170/identity-lab?nointro> (port 5170 — 5173/
  5172/5171 were occupied by other active worktrees this session).

### Jersey audit findings (the actual deliverable — see PR prompt)

- **148 catalog jerseys across 30 MLB clubs: 69 resolve via a curated
  `JERSEY_TREATMENT_OVERRIDES` entry, 79 via `classifyUniformAsset`'s naming
  heuristic.** The 69-entry override count matches the static table exactly —
  no drift between the lab's display and the table itself.
- **No misapplications found.** Checked every heuristic-only row for the two
  failure modes worth checking: (1) a numbered "Alt 2/3/4"-labeled jersey that
  falls through to the plain `alternate` bucket instead of getting its own
  override — several exist (Diamondbacks, Guardians, Twins, Cardinals,
  Rangers all have an unaudited "Alt 2 …" jersey), but (2) no club has TWO
  jerseys colliding on that same plain-`alternate` slot — every club with more
  than one real alternate already has enough override coverage to keep them
  apart. Nothing rendered as an obviously wrong tile for its jersey's name.
- **Season-staleness (PRD §1.5): not yet live.** All 69 override keys carry
  `_2026` and today is still 2026, so the banner reads 69/69 current, 0 stale.
  Per the standing instruction, this is confirmed NOT yet causing a live
  misapplication — the latent bug stays out of scope for this PR, unfixed,
  same as PR 1 left it.
- **New finding, not previously in `PRD.md` §1**: `hasCityConnect(teamId)` is
  true for 28 of 30 clubs (all but the Yankees' opt-out and the Cubs' folded-
  into-Alternate-2 case), but `public/team-logos/city-connect/` only has 20
  files. The 8 gaps — **Tigers, Angels, Dodgers, Twins, Mets, Phillies,
  Pirates, Padres** — are real catalog jerseys the audit's own art-status
  column reports "Missing", not "Shares Main art (by design)" the way the
  verified `alternate-4` gap does (PRD §1.6): unlike that case there's no
  `*_USES_BASE_LOGO` fallback backing these 8, so a real game where one of
  them wears City Connect would render a visible "No logo yet" placeholder
  tile today. `CITY_CONNECT_COLORS` has a related but not identical gap — 19
  entries, missing the Nationals (120) despite the Nationals having a curated
  art file — a colors-only miss, separate from the 8 art gaps. Flagging both
  per the PR prompt's instruction to raise anything the audit surfaces; PR 3
  (art) and PR 5 (colors) own fixing them, not this PR.

### Notes for the next PR

- PR 3's logo-upload pipeline should treat the 8 City-Connect gaps above as
  its highest-value first uploads — they're the only "Missing" (as opposed to
  "shares Main by design") art gaps this audit found across all 148 rows.
- `hexClipboard.js`'s pub/sub is deliberately a bare module-level `Set`, not a
  context — there's no `ClipboardProvider` to wrap; every consumer just calls
  `useHexClipboard()`/`copyHex`/`copyPalette` directly. If a later PR needs
  the clipboard outside `TreatmentBox` (e.g. the audit view growing its own
  copy affordance), reuse this module rather than inventing a second one.

---

## PR 3 — Logo upload pipeline (MLB)

Branch: `claude/logo-upload-pipeline` · PR: #419 · Merged: open

Based on `origin/main` @ `a479798` (PRs 1 and 2 had both merged, as #416 and
#418).

### The upload contract — read this first, PR 4 builds on it

```
POST /__dev/team-logo?teamId={id}&treatment={key}
body:     the raw PNG bytes (Content-Type: image/png)
200:      { "file": "public/team-logos/alternate/TEX.png",
            "url":  "/team-logos/alternate/TEX.png",
            "caveat": null | "no alpha channel — …" }
400:      the reason, as plain text, verbatim from describeLogoRejection()
413:      the body exceeded the stream guard (cap + 64 KB) before validation
```

- **The request never supplies a path.** The directory comes from
  `LOGO_TREATMENT_DIRS` in `src/lib/logoArt.js` (a lab treatment key → the one
  directory it may write into) and the filename from `teamAbbr`, which returns
  `''` for anything that isn't one of the 30 MLB clubs — so an MiLB id has no
  destination today, which is exactly the boundary PR 4 moves. `resolveLogoFile()`
  then asserts the resolved absolute path is **equal to** the one those literals
  spell, not merely under the art root, so a `..` anywhere throws.
- **The standard is 512×512 PNG, under 400 KB**, checked by reading the IHDR
  header bytes directly — no image library, no new dependency. Same functions run
  in the browser for instant rejection and in Node authoritatively.
- **Every successful upload rewrites `src/lib/data/logo-art.json`** from the
  directory contents, keyed `{ dir: { filename: { teamId, bytes, width, height,
  alpha } } }`. Filename-keyed, not team-id-keyed, because `main-overrides/`
  carries both `WSH.png` and `WSH.svg` — and because PR 4's MiLB art, named
  `{teamId}.png`, keys the same way with no reconciliation.
- **PR 4's likely shape:** add `milb-home`/`milb-away` to `LOGO_TREATMENT_DIRS`,
  and replace the `teamAbbr`-only filename resolution in `logoUploadTarget` with
  a per-directory choice of abbreviation vs. team id. Everything else — the
  validator, the guard, the manifest, the drop zone, `TreatmentBox`'s `upload`
  prop — is already generic.

### What landed

**The standard, adopted.** `src/lib/logoArt.js` holds it, and the three
1280×1280 files were downscaled to 512×512 (see the deviation below). Every one
of the 79 committed PNGs now meets it, pinned by a test that reads the manifest
rather than trusting the claim.

**The endpoint.** `/__dev/team-logo`, a second branch of PR 1's `devDataSave()`
middleware, with `scripts/lib/dev-logo-upload.mjs` as its filesystem half. It is
deliberately NOT a `DEV_DATA_STORES` entry — the JSON stores take a parsed object
and a per-store validator, this takes bytes and a header check, and one allowlist
whose entries mean two things is how a validator eventually gets skipped. A unit
test pins that the two key spaces don't overlap. What they do share is the body
reader, factored out of the JSON path in the same shape (413, then destroy).

**Drag-and-drop, on any MLB tile.** `LogoDropZone.jsx` wraps the tile's own logo
box, so the drop target is the thing you are looking at. Also a "Replace art"
button over a hidden file input — same code path, and it makes the flow
scriptable in Playwright, which is how the browser verification below ran.
Rejections are inline, on the tile, naming the reason. After a successful upload
the tile re-requests at `?v={n}`.

**The coverage manifest**, plus `scripts/gen-logo-art.mjs` for the initial build
and for hand-adds, and a test asserting the committed manifest deep-equals what
is on disk.

**Isolation extended.** `check-dist-dev-routes.mjs` now checks both directions:
no dev-endpoint string in `dist/`, AND `dist/team-logos/` non-empty — the
endpoint must not ship, the art always must. Both failure modes were exercised by
planting a string and by moving the directory aside.

### Deviations from the PRD

- **There were three 1280×1280 files, not one.** PRD §1.8 and the PR prompt name
  `alternate/TEX.png` as the sole outlier; `alternate-2/TEX.png` and
  `alternate-3/TEX.png` are also 1280×1280 (`alternate` and `alternate-3` are
  byte-identical files). All three were downscaled — leaving two would have meant
  shipping art the endpoint refuses, and the manifest test would have failed on
  them. Corrected count: 76 of the 79 committed PNGs complied, not 93 of 94 (that
  figure counted the 15 `.svg` files as compliant PNGs).
- **The "transparent" half of the standard is a caveat, not a rejection.** Six
  committed PNGs carry no alpha channel (`alternate-2/SEA`, `alternate-2/WSH`,
  `city-connect/TEX`, `city-connect/WSH`, `main-overrides/SEA`,
  `main-overrides/WSH`) and render correctly — flat art on a solid tile doesn't
  need one. Enforcing alpha would reject art the app is already shipping, so an
  alpha-less upload passes with a note. Dimensions, format, and size are hard
  rejections exactly as specified.
- **`alternate-4` is on the destination allowlist** even though the directory
  doesn't exist (PRD §1.6 — verified correct, not a bug). The lab renders
  alternate-4 tiles for five clubs, so an upload creates the directory rather
  than being turned away. Nothing else about that treatment changed.
- **A generator script was added** (`gen-logo-art.mjs`) alongside the
  endpoint-writes-it-itself requirement. The endpoint still writes the manifest
  on every upload; the script exists because the manifest had to be built once
  before any upload existed, and because a hand-added file otherwise leaves the
  test with no fix to point at.
- **No e2e spec.** Same call PR 2 made: `test/logo-upload.test.js` covers the
  validator and the allowlist as pure logic, and the browser pass below was a
  one-off verification. A spec would have to write real art into the working tree
  and restore it, the way `e2e/uniform-names.spec.js` does — worth adding with
  PR 4 if that file count grows.

### The tile-vs-teams.js gap (worth knowing before uploading)

An upload always lands in the right file, but `teams.js` decides what a tile
actually *wears*, and for three cases that isn't the uploaded `.png`: a club in
one of the `*_USES_BASE_LOGO` sets (renders the plain CDN mark), one filed under
`ALT_LOGO_SVG`, or a Main tile with no `recolor` override. Rather than fix or
hide this, the lab detects the mismatch and says so on the tile after a
successful upload, naming the tables to edit. **PR 2's eight missing City Connect
files (Tigers, Angels, Dodgers, Twins, Mets, Phillies, Pirates, Padres) are all
clean cases** — no `*_USES_BASE_LOGO` entry, no SVG — so dropping art on those
tiles works with no teams.js edit at all. They remain the highest-value first
uploads, as PR 2 flagged; this PR ships the pipeline, not the art.

### Verification

- `npm run lint` clean; `npm test` 783 pass (was 766 — 17 new in
  `test/logo-upload.test.js`); `npm run build` + `npm run check:dist-dev` clean.
- **The validator is tested against real PNGs**, assembled in the test with a
  CRC32 and a zlib IDAT rather than hand-written header bytes — a fixture that
  faked the bytes would only be checking itself. All four cases from the PR
  prompt: a valid 512×512, a wrong-size PNG, a JPEG renamed `.png`, and an
  oversized-but-otherwise-valid file (written with `deflate level: 0` so it is
  genuinely over the cap). Plus empty/truncated input, and traversal-shaped,
  prototype-poisoning, MiLB, and non-integer destinations.
- **The drift test was proved to fail**, not assumed: copying one file to a new
  name made the manifest test fail with the "run `node scripts/gen-logo-art.mjs`"
  message, and removing it restored green.
- **A real upload, through the real UI, against a live dev server.** Replaced the
  Brewers' Alternate mark by driving the file input: the two rejection paths
  showed their reasons inline ("NOT A PNG — …", "256X256 — THE STANDARD IS
  EXACTLY 512X512"), the good file saved, and the tile re-requested at
  `?v=1` and repainted without a restart. `git status` showed exactly one changed
  art file plus the manifest entry moving to `bytes: 2864`. Reverted afterward
  (`git checkout` + regenerate), and the tree is back to the three TEX files.
- **Both consumers checked live** on a real game where the Rangers wore
  `alternate-3` (gamePk 822870, 2026-07-26): the downscaled mark renders cleanly
  on the slate card and the in-game masthead. Old-vs-new were also rendered side
  by side at tile size and at 2.4×— indistinguishable at the size the app draws
  them.
- **The JSON-store path was re-verified after the body-reader refactor**:
  `e2e/uniform-names.spec.js` (4 tests, including the 400 and 413 paths) passes
  against this worktree's server.
- Dev server: <http://localhost:5169/identity-lab?nointro> (5170-5173 were held
  by other worktrees).

### Notes for the next PR

- `logoUploadTarget()` is the one function PR 4 has to change; everything
  downstream of it is already keyed off whatever it returns.
- `TreatmentBox` now takes an optional `upload` prop. MiLB tiles pass nothing
  today, so wiring PR 4's drop target is a matter of passing it from
  `profiles/milb.jsx` — the component work is done.
- The manifest is keyed by directory then filename, which already accommodates
  `{teamId}.png` names without a schema change.
- `docs/uniforms-and-logos.md`'s §2 recommendation is now marked as built.

---

## PR 4 — MiLB home/away logo art

Branch: `claude/milb-logo-art` · PR: #420 · Merged: open

Based on `origin/main` @ `4b9b940` (PR 3 had already merged as #419).

### What landed

**Two new id-keyed directories**, `public/team-logos/milb-home/` and
`milb-away/` — empty today, per PRD 4.3's "ships with zero art." Added to
`LOGO_TREATMENT_DIRS` (`src/lib/logoArt.js`) as `'milb-home'`/`'milb-away'`,
alongside a new `MILB_LOGO_DIRS` export (`['milb-home', 'milb-away']`) both
`logoUploadTarget` and the manifest builder branch on, so the one thing PR 3's
notes-for-next-PR flagged — "`logoUploadTarget()` is the one function PR 4 has
to change" — is exactly what changed: a request for one of these two
directories is filed by team id (`{teamId}.png`, `teamId` a bare positive
integer, no `teamAbbr` involved) instead of by MLB abbreviation. Everything
downstream (the endpoint, the stream guard, the validator) is untouched, as
predicted.

**`milbTreatmentTile` extended, not rewritten.** A new `milbHasLogoArt(teamId,
variant)` in `milbColors.js` reads coverage straight from the same
`logo-art.json` manifest MLB's upload rebuilds — never a per-tile `onError`,
which with 120 affiliates × 2 sides would fire hundreds of 404s per slate
(PRD 4.3). `milbTreatmentTile`'s only change is its `logoVariant` line: curated
art when the manifest has it, `'base'` (today's tinted CDN mark) otherwise —
`tint`/`offsetX`/`offsetY`/`scale` are computed exactly as before, so a
transparent curated PNG still sits on the researched fill rather than a bare
white box. `teamLogoUrl` (`teams.js`) grew a matching `'milb-home'`/
`'milb-away'` branch — `/team-logos/{variant}/{teamId}.png` — so `TeamLogo`,
the one component every logo consumer in the app already goes through, needs
no changes at all to render it.

**Wired into the lab.** Both MiLB tiles now pass `upload` to `TreatmentBox`
(treatment `milb-home`/`milb-away`), reusing PR 3's `LogoDropZone` completely
unchanged. Unlike MLB, there is no `uploadCaveat` — MiLB's manifest *is* the
switch that decides what a real tile wears (no separate `teams.js` override
table to fall out of step with), so an upload can never land somewhere the
shipped tile won't pick up. A new `MilbTreatmentLogo` local component (mirrors
`profiles/mlb.jsx`'s `TreatmentLogo`) renders the curated mark with a `?v=`
cache-buster after a same-session upload, falling back to the plain `TeamLogo`
on a 404 or before any art exists.

**Coverage is scannable per level (PRD 4.3).** Extended the existing
`rowBadge` (already flagging "no researched color") to also flag `no home
art` / `no away art` / `no logo art` — reuses the row header every team
already renders, collapsed or not, rather than adding new UI. Scanning a
level's full list (up to 30 rows) now answers "which affiliates still need
art" without expanding a single tile.

### Deviations from the PRD

- **No MLB-club-style team-id whitelist for the MiLB directories.** MLB's path
  checks `teamId` against the 30 real clubs (via `teamAbbr`); MiLB has no
  equivalent closed catalog in this repo (affiliates come from a live
  `/data/affiliates.json` fetch, not a static table), so `logoUploadTarget`
  only enforces "positive integer" for these two directories. Not a
  regression: the security boundary was always "no path from the request,"
  never "team id must be real," and a bogus id just creates a file nothing
  ever reads (same shape as `alternate-4`'s directory-created-on-first-upload
  behavior PR 3 already established for a treatment with no clubs on it yet).
- **`logoUploadTarget` accepts an MLB club's own id under `milb-home`/
  `milb-away`** (e.g. `logoUploadTarget(140, 'milb-home')` resolves), since
  there's nothing MiLB-specific to check an id against. Harmless in practice —
  nothing in the app ever calls `milbTreatmentTile` for an MLB team id
  (`TeamTreatmentMark`'s `isMlbTeamId` branch routes those through
  `treatmentTile` instead) — but worth knowing if a future PR wants to
  tighten it.

### Verification

- `npm run lint && npm test` clean; `npm test` 788 pass (was 783 — 5 new,
  split across `test/logo-upload.test.js` (the id-keyed destination/manifest
  cases) and `test/milb-team-wiring.test.js` (`milbHasLogoArt` and the
  `logoVariant` switch, pinned against the committed manifest — empty today,
  so both assert the zero-art baseline rather than faking a manifest entry, a
  static JSON import can't do mid-test)).
- `npm run build` + `npm run check:dist-dev` clean — 94 curated marks still
  ship (unchanged; the two new directories are empty), no dev-endpoint string
  in `dist/`.
- **A real upload, through the real endpoint, against a live dev server.**
  POSTed a hand-built 512×512 PNG to `/__dev/team-logo?teamId=556&treatment=milb-home`
  (Nashville Sounds): `{"file":"public/team-logos/milb-home/556.png", ...}`
  came back, the manifest gained a `milb-home` section keyed `"556.png"`, and
  a Playwright screenshot of `/identity-lab` (Triple-A dimension) showed the
  Nashville Sounds row badge flip from nothing to **"no away art"** (home now
  covered) while every other row still read "no logo art" — confirming both
  the upload path and the coverage badge move independently per side.
  Reverted (`rm` the file + `node scripts/gen-logo-art.mjs`); tree back to the
  committed 94-file baseline.
- **No 404 storm, confirmed rather than assumed.** With zero art on disk,
  `milbHasLogoArt` is false for every team, so `logoVariant` stays `'base'`
  everywhere and `teamLogoUrl` never even builds a `milb-home`/`milb-away`
  URL — a Playwright pass over the home slate (MLB level) recorded zero
  console errors and zero failed `team-logos` requests. Today's AAA slate is
  an off day league-wide, so a live tinted MiLB masthead wasn't available to
  screenshot this session; the "zero art → zero behavior change" argument
  above is why that gap doesn't block this PR — `milbTreatmentTile`'s
  pre-existing unit tests (`test/milb-team-wiring.test.js`, unchanged
  assertions) already pin every existing team's tile at `logoVariant: 'base'`.
- Dev server: <http://localhost:5174/identity-lab?nointro> — ports 5169-5173
  were all held by other active worktrees this session.

### Notes for the next PR

- `MILB_LOGO_DIRS` (`src/lib/logoArt.js`) is the one export a future PR needs
  to extend if a third id-keyed directory shows up; `logoUploadTarget` and the
  manifest builder both already branch on it rather than hard-coding
  `'milb-home'`/`'milb-away'`.
- PR 5's colour reconciliation is unrelated to this PR's manifest — `tint`
  still comes from `milbLogoPosition`'s `bg`, untouched here.

---

## PR 5 — MiLB colour reconciliation, one fallback chain, stash retired

Branch: `claude/milb-color-reconciliation` · PR: #421 · Merged: open

Based on `origin/main` @ `2f9fcf2` (PRs 1-4 had all merged, as #416, #418, #419,
#420).

### The merge really was a no-op — re-confirmed, then skipped

Re-ran the diff PRD §1.2 records, on the actual files rather than trusting the
note: 120 stash entries, 115 live, **0 in live but not in stash, 0 hex
disagreements across the 115 shared**. Nothing was merged. All 115 live pairs
are byte-for-byte unchanged in the new file, asserted by the build script rather
than eyeballed.

### What landed

**`src/lib/data/milb-colors.json` is now 120 entries** carrying the metadata the
earlier copy dropped: `third` (101 entries), `confidence` (all 120 — 6 high,
107 medium, 7 low), `source` (113), and `note` (31). The two known-bad flags
survived — **106 Erie SeaWolves** (mislabeled source) and **3410 Richmond**
(pre-2026 identity) — and where both files carried a note, the stash's fuller
text won, so the retired README is no longer load-bearing.

**The 5 gaps, per PRD §5, no hex invented:**

| Team | Outcome |
| --- | --- |
| 6325 Columbus Clingstones | Promoted the lab's `#f58b6d`/`#000000`. `confidence: low`, note records that it matches the research reading `#FF8D6D`/`#010101` in swapped roles. |
| 546 Portland Sea Dogs | Promoted `#e03a3e` as primary. `confidence: low`, the conflict note preserved verbatim with the resolution appended. |
| 482 Corpus Christi, 553 Knoxville, 1956 Somerset | `"found": false`, no `pair`. |

**Portland's secondary is a judgement call worth reviewing.** The prompt named
only the primary (`#e03a3e`). "Resolves toward the sportsfancovers reading" was
taken to mean that whole reading — Red `#e03a3e` / Navy `#003263` / Gray
`#cbccce` — so the pair is `['#e03a3e', '#003263']` with `third: '#cbccce'`,
mirroring the stash's own primary/secondary/third ordering. Nothing user-visible
turns on it either way: 546 has landed `MILB_LOGO_POS_OVERRIDES` bgs for both
sides (`#e03a3e`/`#cbccce`) that win over the pair, and the tint reads `pair[0]`.

**One chain, in `src/lib/brandColors.js` (new).**

```
1. the affiliate's own researched pair   (data/milb-colors.json)
2. its parent MLB org's pair             (via MILB_PARENT_ORG)
3. NEUTRAL_FALLBACK_PAIR                 (milbColorPair only)
```

`milbBrandPair` is steps 1-2 and returns **null**; `milbColorPair` adds step 3.
One ordering, two endings — every caller's existing null-vs-neutral contract is
preserved without a second chain. `teamTintColor`, `resolveTeamColorPair`
(behind `teamStripeGradient`/`teamPrimaryColor`/`teamChipColors`), and
`milbTreatmentTile` all read it now.

### Deviations from the PRD

- **A new module was needed, and this is the one structural surprise.**
  `milbColors.js` already reaches `teams.js` transitively (`milbColors.js` →
  `wpaLogo.js` → `teams.js`), so putting the chain in either file and importing
  the other closes an import cycle. `TEAM_COLOR_PAIRS` and the generated
  `MILB_PARENT_ORG` block moved verbatim into `brandColors.js`, a leaf that
  imports only `tuningStore.js` and the JSON; `milbColors.js` re-exports the
  chain so no existing consumer changed its import. **`MILB_PARENT_ORG` stays**
  as instructed — same data, same generator, one file over.
  `scripts/gen-milb-team-colors.mjs` was retargeted and re-run: it rewrites the
  block in the new home and the tree is unchanged afterward.
- **Step 2 hands back the parent org's `TEAM_COLOR_PAIRS` primary, not its
  `TEAM_COLORS` accent** — that is what PRD §5.1 spells out. For the 3 clubs on
  step 2 the tint therefore moves from the org's rival-distinguishing accent to
  its true primary (Corpus Christi: Astros orange `#EB6E1F` → Astros navy
  `#002D62`). Deliberate, and the accent table is untouched for the 30 MLB clubs.
- **`OffDaySection` is NOT affected**, contrary to the PR prompt's framing. It
  reads `favoriteAccentColor` and the `mainTreatment*` resolvers, all MLB-only
  tables that return null for a MiLB id. It never touched `teamTintColor` or the
  pair chain. Checked, not assumed.
- **Two existing assertions in `test/identity-lab-stores.test.js` had to change**
  because the data model did — both were tightened, not loosened. "every entry
  has a pair" became "every entry has a pair **or** an explicit `found: false`,
  never both, and a `found: false` entry must carry a note explaining why"; the
  115-vs-115 count became 117 pairs vs 120 entries with the three unresolved ids
  named.

### What actually changes on screen

- **117 of 120 affiliates** now tint their headshots (and their box-score favor
  stripe / chip colours) with **their own** colour instead of their parent org's.
  The other 3 fall to step 2.
- **Zero MiLB logo tiles move.** Computed across all 120 affiliates × both
  sides: every one either has its own researched pair already or a landed
  `MILB_LOGO_POS_OVERRIDES` bg that wins. The treatment-tile path is unchanged
  in practice — the chain only *unified* it.
- The 3 unresolved clubs keep their `#FFFFFF`/`#D0D0D0` placeholder tiles and
  are still flagged "no researched color" in the lab.

### Verification

- `npm run lint` clean; `npm test` **802 pass** (was 788 — 14 new across the new
  `test/milb-color-chain.test.js` and additions to `dev-data-stores` /
  `identity-lab-stores`). `npm run build` + `npm run check:dist-dev` clean.
- **The chain tests were proved to fail without the change**, not assumed:
  reverting `teamTintColor`/`resolveTeamColorPair` to the parent-org-first form
  failed 4 of the 11 new tests — the three step-1/step-2 behaviour pins plus the
  tint's exact rgba. Restoring turned them green.
- **Read off the real DOM, on real MiLB games** (2026-07-26, dev server), not
  from the resolver: Memphis's lineup page (Durham's starter) painted
  `rgba(0, 84, 164, 0.22)` = Durham's own `#0054A4` — it painted
  `rgba(245, 209, 48, 0.22)` (the parent Rays' accent) with the change
  temporarily reverted, same page, same session. Corpus Christi's page
  (Amarillo's starter) painted Amarillo's own `#003A70`; Amarillo's page
  (Corpus's starter, the `found: false` club) painted Astros `#002D62` —
  **step 2 confirmed in the browser, not just in a test.**
  gamePks 816176 (`/07262026/durmem/…`) and 817480 (`/07262026/amacc/…`).
- **A MiLB team page's headshots did NOT change**, and that's correct:
  `TeamPage` passes the parent org's id to `TeamLeaders` on purpose (org-wide
  leaders). Worth knowing before someone reports it as a miss.
- **The lab, Double-A dimension**: exactly 3 rows flagged "no researched color ·
  no logo art" (Corpus Christi, Knoxville, Somerset), 27 flagged "no logo art"
  only. Portland and Columbus no longer carry the colour flag. No console errors.
- Dev server: <http://localhost:5165/07262026/durmem/lineup2?nointro> — **port
  5165, off-band.** All five reserved ports (5169-5173) were held by other active
  worktrees this session, and 5174-5178 belong to the sibling tally-nfl repo.
  The lab is at <http://localhost:5165/identity-lab?nointro>.

### Notes for the next PR

- **PR 6's header-triad rename lands in two places now**, not one:
  `milb-treatment-tuning.json`'s `header` records and `mlb-treatment-tuning.json`'s.
  `brandColors.js` carries no header colours, so it is not involved.
- **PR 7's cleanup list:** `.scratch/milb-team-colors/` is now a README-only stub
  (methodology + confidence definitions + the unresolved list). Its data file is
  gone. Nothing else points at it — `milbColors.js`'s "see the stash README"
  pointer was removed with this PR.
- **The 3 clubs still unresolved are 482 Corpus Christi Hooks, 553 Knoxville
  Smokies, and 1956 Somerset Patriots.** All three are 2025/2026 rebrands where
  research found colour NAMES only. A future pass starts there; the stub README
  lists what each source did and didn't have. Adding a pair is a one-line store
  edit — drop the `"found": false`, add `"pair"` — and the validator enforces
  that the two are mutually exclusive.
- `brandColors.js` is where a third fallback rung would go if one is ever
  wanted. Don't add one to a caller.

---

## PR 6 — Theming, uniform display, the contrast guard, and ADR-0030

Branch: `claude/team-theming-uniforms` · PR: #423 · Merged: open

Based on `origin/main` @ `ff9ce29` (PRs 1-5 had all merged, as #416, #418, #419,
#420, #421).

### The header tables ship

`TREATMENT_HEADER_COLOR_OVERRIDES` / `MILB_HEADER_COLOR_OVERRIDES` had carried
"design-lab preview only — no real component reads this table yet" since they
were created. They now dress the **lineup page**: `.teaminfo__head` becomes a
real club-coloured bar, and that side's `SectionMasthead`s take the same fill,
tape edge, and ink. Paging away → home now reads as two different clubs' sheets.

**One resolver, `src/lib/headerTheme.js`**, between the two tables and the one
surface that reads them. `headerThemeFor(teamId, treatment)` returns
`{ bar, accent, onBar, onBarTone }` or **null**, plus `headerThemeStyle` /
`headerThemeClass` so a caller spreads one value instead of rebuilding the same
three-property object. The mechanism is three CSS custom properties scoped to
`.teaminfo` (phone) or `.teampanel` (one column of the wide spread), every rule
reading them *with the default as its fallback* — so an unthemed page renders
byte-identically to before.

**The triad was renamed `{ blue, gold, font }` → `{ bar, accent, onBar }`** in
both stores (67 records) and everywhere that reads them. The old names described
the *default navy chrome's* own colours and stopped meaning anything once a
club's bar was red. PR 2's palette clipboard had already guessed these names, so
`TreatmentBox`'s paste boundary lost its mapping layer entirely.

### The guard is the point, and it found 15 real failures

`scripts/check-contrast.mjs` now asserts, for **every** entry in both stores,
that `onBar` clears WCAG AA (4.5:1) against `bar`. On first run **15 of the 67
landed triads failed** — nearly all of them cream `#FBF6E9` on a bar too light
or too warm to hold it (four greys at 2.39:1, Braves City Connect at 2.33,
Orioles Main at 3.88, Astros Alternate at 2.87…). All 15 were fixed by changing
`onBar` only; **no `bar` or `accent` hex moved**, so the tuning the owner did by
eye survives intact:

| Club | Treatment | onBar → | ratio |
| --- | --- | --- | --- |
| 110 Orioles | main | `#000000` | 5.01 |
| 112 Cubs | alternate-2 | `#000000` | 7.15 |
| 114 Guardians | alternate-2, alternate-3 | `#FFFFFF` | 4.71 |
| 115 Rockies | alternate-2 | `#33006F` (their purple) | 5.94 |
| 116 Tigers | alternate | `#000000` | 5.95 |
| 116 Tigers | alternate-3 | `#0C2340` (their navy) | 6.12 |
| 117 Astros | alternate | `#000000` | 6.78 |
| 142 Twins | alternate-3 | `#002B5C` (their navy) | 5.43 |
| 144 Braves | city-connect, alternate-3 | `#13274F` (their navy) | 5.84 / 6.21 |
| 145 White Sox | alternate-3 | `#000000` | 8.14 |
| 146 Marlins | alternate-3 | `#000000` | 6.31 |
| 546 Portland | home, away | `#000000` | 4.84 |

Where a club's own dark colour cleared the bar it was preferred over black
(Rockies, Tigers alt-3, Twins, Braves); where it did not (Astros navy at 4.37,
Tigers navy at 4.48 — both near-misses) black was used rather than inventing a
brand hex. **The guard was proved to fail**, not assumed: planting an unreadable
pair on the Brewers made `npm run lint` exit non-zero naming that exact entry.

`accent` is deliberately NOT asserted — it is the bar's 3px tape edge, a rule
against the page rather than text against the bar, and holding it to a ratio
would forbid the tone-on-tone edges several clubs' liveries actually use. The
guard now shares `src/lib/contrast.js`'s ratio math instead of keeping a second
copy, so the lab's live readout and lint cannot disagree.

### The invariant

**Theming's only inputs are `(teamId, treatment)`.** Written into **ADR-0030**
and `src/lib/CLAUDE.md`, and — this is the part worth knowing —
`test/header-theme.test.js` asserts it *structurally*: it reads
`headerTheme.js`'s own source and pins its import list to exactly
`['./contrast.js', './milbColors.js', './teams.js']`. Wiring a feed, linescore,
or reveal module in fails a test rather than a review.

### Deviations from the PR prompt, and one thing it did not anticipate

- **The mono club mark needed its own answer, which the prompt did not cover.**
  A themed masthead carries the `mono` knockout mark — a flat white silhouette
  (ADR-0025). On a light bar (several clubs' greys and creams) it vanishes, and
  no text-contrast rule catches that. The fix is `filter: brightness(0)` on the
  mark when `onBarTone` is dark. **This is not the filter-whitening ADR-0025
  forbids**: that failure mode is filtering *full-colour* art, whose light-fill
  interior detail flattens into a blob. The mono asset has already been through
  that reduction — one opaque shape plus transparency — so darkening it is
  exact. The alternative considered and rejected was asserting white-vs-`bar` in
  the guard, which would have forced ~11 deliberately light bars (Royals CC
  white, Braves alt-2 cream, Orioles CC beige) dark to satisfy a mark problem.
- **`useGameData`'s `winProbTreatment` was renamed `jerseyTreatments`.** It now
  has two consumers, not one; the prop name going into `InningViewer`/`BoxScore`
  is unchanged, so the diff is three lines in `GameView`.
- **The `.teaminfo__head` bar changes SHAPE when themed** (plain heading →
  padded bar with a radius and a tape edge). Unavoidable: a colour needs
  something to sit in. Unthemed pages are untouched.
- **The wide spread scopes the theme per COLUMN**, not per page: it puts both
  clubs on one sheet, and the sections it shares between them (umpires, season
  series, former teammates, career matchups) belong to neither, so they stay
  navy. The phone page, which is one club's sheet, themes throughout.
- **`sportId` is not in scope at TeamPage's render site** (it is local to the
  loader); the existing `isMilb` on the line above the destructure is what the
  strip branches on.

### The owner's extra ask — wear dates → game photos (prompt item 5)

Every MLB tile in the lab now carries a **WORN** row of up to 10 small date
buttons (`6/28/26`, most-recent-first) that open that game's photo gallery
(`/photos/{gamePk}`) — so a curated tile can be checked against a photograph of
the real uniform instead of trusting the swatch.

The join is a new pure `jerseyWearDates` in `src/api/jerseys.js`:
`jerseys.json` is keyed by gamePk and carries **no date**, a team schedule
carries **no jersey**, and nothing else in the app knows both halves. It reads
only `gamePk`/`apiDate` — the schedule's `won` is deliberately untouched.
Fetched lazily per EXPANDED row (the same shape `TeamLabRow`'s `lastOpponent`
already uses), so a page load still fires nothing; `fetchJerseysData`'s
module-level cache means 30 clubs share one request for that half.

No MiLB equivalent: there is no MiLB uniform feed, so there is nothing to join.

### Uniform sets on `TeamPage`

`JerseyCombos` grew a `variant="static"` mode and a `MilbUniformStrip` wrapper:
a MiLB club's hub now shows a two-card Home/Away strip from `milbTreatmentTile`,
**with no W-L** (PRD §1.9 — no per-game MiLB jersey feed exists to attribute a
game to, and inventing one is out of bounds). `TeamTreatmentMark` already
accepted `side`, so it needed no change. MLB's strip is untouched, and
**`buildJerseyCombos`'s cutoff-gated per-jersey W-L was not touched**.

### The lab states its own coverage

Each tile's Header colors panel now shows **Themed** vs **Default chrome** (is
this triad what the app actually renders, or a proposal it is still answering
with navy?) and a live `On bar vs bar: 13.60:1 — clears WCAG AA` readout — the
same ratio lint computes, so a bad pair is visible while it is being typed
rather than at commit time.

### Verification

- `npm run lint` clean (including the 67-triad header check); `npm test` **813
  pass** (was 802 — 11 new across `test/header-theme.test.js` and
  `test/jerseys.test.js`); `npm run build` + `npm run check:dist-dev` clean.
- **Read off the real DOM**, not from screenshots — a throwaway Playwright spec
  run across all three viewport projects (mobile/ipad/desktop), 18/18:
  - **Braves (`alternate-3`) at Orioles (`main`), 2026-07-26.** Away bar painted
    `rgb(162,170,173)` = `#A2AAAD` with a `#CE1141` tape edge and `#13274F` ink
    on both `.teaminfo__name` and `.metricbar__title`; the class carried
    `is-themed--dark` and the mono mark's computed filter was `brightness(0)`.
    Home bar painted `rgb(223,70,1)` = `#DF4601` with `#000000` ink — a
    genuinely different bar, which is the whole feature.
  - **The bar guesses then corrects.** It first paints `defaultTreatmentFor`'s
    predicted jersey and swaps once `jerseys.json` resolves — the same behaviour
    the slate card and WPA band already have. The spec waits for the settled
    value; worth knowing before someone reports the flash as a bug.
  - **Yankees (no header entry): zero `.is-themed` elements on the page**, head
    background `rgba(0,0,0,0)`, masthead `rgb(27,42,58)` + `rgb(181,130,74)`
    tape + `rgb(251,246,233)` ink — default navy chrome, untouched.
  - **Innings viewer and box score**: zero themed elements, zero non-navy
    mastheads, `--bar-fill` unresolvable on `body`. The properties never reach
    them.
  - **A MiLB lineup page** (`/07262026/durmem/lineup1`, Durham away): bar
    `rgb(0,84,164)` = `#0054A4`, accent `#B15C12` — resolved through the
    Home/Away table, confirming the two vocabularies stay separate. No console
    errors.
  - **The lab**: 4 of 5 Braves tiles "Themed", 0 failing contrast readouts, date
    groups capped at 10 (`[9,7,10,10,9]`), format `6/28/26`, and clicking one
    navigated to `/photos/823204`.
  - **MiLB TeamPage strip**: exactly 2 cards, `Home`/`Away`, both `rec: null`,
    with different tints (`#0054A4` / `#B15C12` — the pair swapped). **MLB
    TeamPage strip**: 5 cards, 5 records — unchanged.
- Dev server: <http://localhost:5164/07262026/atlbal/lineup1?nointro> — **port
  5164, off-band.** All five reserved ports (5169-5173) were held by other
  active worktrees this session, as were 5165 and 5174-5190.

### Notes for the next PR

- **PR 7's cleanup list gained nothing from this PR** — the stale "no real
  component reads this table yet" comments in `teams.js`, `milbColors.js`,
  `HeaderPreview.jsx` and `index.css` were all corrected here rather than left.
- **Coverage is 67 (club, treatment) pairs out of several hundred possible.**
  Extending it is pure data work in `/identity-lab` + Save; the guard refuses an
  unreadable pair, so it is safe to hand to anyone. The lab's own row list is
  the worklist.
- `headerThemeFor` returning **null** rather than a synthesised triad is
  deliberate (ADR-0030) — a synthesised bar is an unreviewed colour pair the
  guard cannot vouch for. Do not "improve" it into always answering.
- If a future surface wants theming, it sets the same three properties and adds
  a fallback; it does not get a second resolver. If it wants a colour that
  depends on anything but `(teamId, treatment)`, that is a new ADR.

---

## PR 7 — Docs and cleanup

Branch: `claude/identity-lab-docs` · PR: (opening) · Merged: open

Based on `origin/main` @ `665f5ee` (PRs 1-6 had all merged — #416, #418, #419,
#420, #421, #423 — confirmed by fetching `origin/main` directly rather than
trusting this file's own status board, which still read PR 5 "open" and PR 6
"not started" at the time this PR started; both were stale).

### What landed

**The ADR-0025 collision, resolved.** `docs/adr/0025-one-color-team-marks-are-
precomputed-knockouts.md` → `0031-one-color-team-marks-are-precomputed-
knockouts.md` (0025-admin-editable-copy-store.md keeps its number — it's the
older ADR and is itself cross-referenced by ADR-0026 and ADR-0029, so
renumbering it would have touched more files). Every `ADR-0025` reference that
actually meant the logo-mono ADR was updated to `ADR-0031`: `.github/workflows/
update-teams.yml`, `scripts/CLAUDE.md`, `src/CLAUDE.md`, `src/index.css` (×3),
`docs/adr/0030-club-theming-is-identity-only.md` (×2), `src/lib/CLAUDE.md`
(×2), `src/lib/logoMono.js`, `test/logo-mono.test.js`,
`scripts/gen-mono-logos.mjs`, `src/lib/teams.js`, `src/components/TeamLogo.jsx`.
Two references genuinely meant the copy-store ADR (root `CLAUDE.md:152`,
`docs/adr/0029-...:5`, and one line in `src/CLAUDE.md` this pass's own sed
first mis-touched then reverted) and were left/restored at `ADR-0025`. The two
historical scratch docs that narrate the collision itself
(`.scratch/team-identity-lab/PRD.md`, `.scratch/team-identity-lab/prompts/
07-docs-cleanup.md`) were left as the record of what the collision was, not
live references.

**The stale scratch doc, rewritten as history.**
`.scratch/gamecard-team-colors/issues/01-solid-tile-colors.md`'s `Status:`
moved from `needs-triage` to `wontfix`, and its prose now leads with "this is a
past experiment, code since removed" rather than describing
`GAMECARD_TILE_COLORS`/`gameCardTileColor()` as present-tense live code (they
were already gone before this effort began — PRD §1.3). The hand-picked
per-team colour table stays, since re-deriving it would be wasted work if this
idea resurfaces.

**`src/lib/CLAUDE.md` reconciled against what actually landed**, not rewritten
from scratch — PRs 1-6 had already kept it current as they went (each PR's own
notes above call this out; PR 6 explicitly says "PR 7's cleanup list gained
nothing from this PR"). Read start to finish against the PRD §7's cleanup
checklist; one real gap found and filled: **`TeamLogo`'s own variant → base →
monogram fallback chain wasn't documented anywhere in this file** — the colour
chain (`brandColors.js`) was, but the separate, orthogonal fallback the
`TeamLogo` component itself walks (a 404'd variant retries the base mlbstatic
mark; no id or a failing base draws a monogram) wasn't. Added a short section
for it, keyed to `src/components/TeamLogo.jsx`'s own comment block. Everything
else the PR prompt asked for — the MLB/MiLB treatment vs. variation split, the
tuning-table JSON stores and where they're read, both fallback chains, the
jersey-feed/static-heuristic boundary (MiLB has none), the 512×512 PNG
standard, the dev-only write-back — was already there.

**One stray comment corrected in passing**: `src/lib/teams.js`'s
`teamColorSwatches` doc comment still said "Built for the team-color-lab dev
page" pointing at `src/screens/identity-lab/` — the old screen name next to the
new directory. Renamed to "Team Identity Lab dev page" for consistency; not
otherwise in scope, but a one-line fix directly adjacent to work this PR was
already doing.

### Verification of "no stale route reference"

Grepped the whole repo (outside `.scratch/`) for `team-color-lab`,
`team-pattern-lab`, `TeamColorLab`, `MilbTeamColorLab`, `TeamPatternLab`. Six
non-scratch hits, all legitimate: `src/lib/route.js` and
`src/screens/identity-lab/index.jsx` explain what the retired routes were
replaced by (past tense, "replaced /team-color-lab..."); `test/route.test.js`
names the literal retired path strings it asserts fall through to home;
`scripts/lib/schema.sql` and `scripts/gen-jerseys.mjs` reference a
**hypothetical future** "team-color-lab correlation page" unrelated to this
effort's renamed lab; `docs/adr/0025-admin-editable-copy-store.md` cites
`team-color-lab` as a historical precedent for an unlisted dev route, correctly
past-tense. Nothing reads as if the old routes are current.

### Deviations from the PRD

- **This file's own status board was wrong before this PR started** — PR 5 was
  marked "open" and PR 6 "not started" even though both had merged (#421,
  #423). Fixed as part of this PR's own status-board update rather than filed
  as a separate finding, since PRD §9's standing rule ("fetch and inventory ...
  before choosing a base") is exactly what caught it: `git log origin/main`
  showed both merge commits before any doc was touched.
- **No new ADR number needed beyond the rename.** The PRD's "next free number is
  0029" (§1.9) was already stale by the time this PR started — PRs 1 and 6 had
  taken 0029 and 0030 for their own work. The collision fix took 0031, the true
  next-free number as of this PR.

### Things deliberately left alone

- **`JERSEY_TREATMENT_OVERRIDES` season-key staleness** (PRD §1.5) — still
  unfixed, still flagged live by PR 2's audit banner (69/69 current as of
  2026-07-27, 0 stale). Out of scope for every PR in this effort; a future pass
  starts at PR 2's `profiles/audit.jsx`.
- **The 3 unresolved MiLB colour teams** (482 Corpus Christi, 553 Knoxville,
  1956 Somerset) — PR 5 left them `"found": false` by design; the stub
  `.scratch/milb-team-colors/README.md` names what each source did and didn't
  have. Adding a pair later is a one-line store edit.

### Verification

- `npm run lint && npm test` pass (813, unchanged from PR 6 — no source
  behaviour changed, only comments/docs/scratch prose).
- `npm run build` clean.
- Grepped for every renumbered ADR reference (`ADR-0025`, `ADR-0031`) across
  the repo and confirmed each now names the ADR it actually means — no doc
  cites `ADR-0025` for the logo-mono knockout-mark rule, and no doc cites
  `ADR-0031` for the copy-store rule.
- No dev server started — cleanup only, no user-visible change, per the PR
  prompt's own verification section.
