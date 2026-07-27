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
| 3 | Logo upload pipeline (MLB) | **open** | `claude/logo-upload-pipeline` | — |
| 4 | MiLB home/away logo art | not started | — | — |
| 5 | MiLB colour reconciliation | not started | — | — |
| 6 | Theming + uniform display | not started | — | — |
| 7 | Docs + cleanup | not started | — | — |

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

Branch: `claude/jersey-audit-hex-copy` · PR: #TBD · Merged: open

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

Branch: `claude/logo-upload-pipeline` · PR: #TBD · Merged: open

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
