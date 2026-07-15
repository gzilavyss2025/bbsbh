# Game Notes GREEN-tier QA — session handoff

Working notes for picking this up in a fresh context. Read this before re-deriving
anything below — it's already been figured out once.

## Where things stand

- **PR #174** (branch `worktree-game-notes-review`, pushed) has 4 commits: the
  systemic parser fix, sentence-case + loading-animation modal polish, the new
  `/game-notes-debug` QA page, and a follow-up Dodgers widening. All lint/build
  clean, all 14 calibrated clubs re-verified against fresh PDFs after each change.
- The maintainer is doing a **club-by-club manual review** via `/game-notes-debug`
  (open the modal for each calibrated club, read the blurbs, report anything odd).
  This is in progress — not all 14 clubs have been eyeballed yet. Continue that
  loop: wait for the next club's report, root-cause it the same way as below, fix,
  verify, commit, push (same PR branch — just keep committing to it).

## The core bug class (now understood, mostly fixed)

`extractFlowBoldZone` in `src/api/whatsBrewing.js` used to filter body words by a
**flat per-club `columnMaxX`** (calibrated tight, ~150pt). This is fundamentally
fragile: a genuinely separate second column (a sidebar box, a stat table) can sit
on the **same baseline** as a wrapped narrative line, so no single fixed x cutoff
works — too tight chops real prose (a bold name at the end of a list, or even a
mid-word line-wrap hyphen), too loose lets the sidebar bleed in wholesale.

**Fix shipped**: `lineMarkerCutoff` computes a **per-line** dynamic cutoff — scan
each baseline for a genuine second-column marker (a head-font run that is, up to
its own colon, ALL-CAPS and either multi-word or 6+ chars — long enough to not
false-positive on bold box-score abbreviations like "ND"/"HR"/"ERA") — and
truncate only there. A plain bold player name is mixed-case and never trips it.
The per-line cutoff is stamped directly onto each word (`w.cutoff`) during the
initial line-grouping pass, NOT re-derived later via a second fuzzy y-lookup — an
earlier version of this fix had a real bug where two baselines within `tol` of
EACH OTHER (not the same line) could get cross-contaminated cutoffs.

**Then, per club, `columnMaxX` was widened** — but only after a **geometry scan**
confirming where a *recurring* second column actually starts (a single wide line
is not evidence of a second column; a cluster of many lines starting at the same
x is). Blindly widening without this check caused real regressions during this
session (PHI's day-by-day stat table got swallowed whole when its columnMaxX
was raised to match `rightTableMinX`) — always verify with the histogram
approach in `column-scan.mjs` before picking a new value.

**Widened so far** (old → new, all verified against fresh PDFs):
- LAA (108): 150 → 238 (real 2nd column confirmed at ~240)
- KC (118): 150 → 215 (real 2nd column confirmed at ~220-230)
- LAD (119): 150 → 300 → **438** (first pass wasn't wide enough; a name list AND
  a line-wrap hyphen both sat past 300; real 2nd column confirmed at ~440)
- MIA (146): 150 → 300 (real 2nd column confirmed at ~310)
- NYM (121): 150 → 310 (real 2nd column already fenced by existing
  `rightTableMinX: 320`; fixed a word literally split mid-letter, "Mets
  d|ropped", plus a missing sentence lead-in and a garbled raffle blurb)
- **PHI (143) and HOU (117) were reverted back to 150** after widening caused
  regressions (PHI: a day-by-day stat table got wrongly promoted into blurbs;
  HOU: not individually re-verified as safe, left conservative). If either gets
  a "dropped word" report, they need the SAME geometry-scan-first treatment as
  the ones above, not a blind widen.
- BOS (111), ATH (133): scanned, found genuinely low risk (0-3 suspect mixed-case
  runs past the old cutoff), left untouched at 150. Could still have an
  undiscovered edge case — same playbook if reported.
- SEA (136), NYY (147): **known residual issues, NOT YET FIXED** — SEA had some
  blurbs truncating mid-sentence / absorbing a stray table header; NYY's "RICE
  RICE BABY"/"GOOD SCHLITT" blurbs have a numeric stat-table leaking into the
  body (no `rightTableMinX` fence there, and NYY uses the two-column `columns:`
  config which is a different code path than the single-zone clubs above — the
  marker-cutoff logic still applies per-zone, but hasn't been specifically
  audited for these two clubs yet).
- PIT (134) and MIL (158) use different layouts (`flow` and `column`
  respectively) — NOT affected by this bug class at all (different code paths).

## Two other bugs fixed (systemic, not per-club)

1. **Superscript ordinals** ("2nd", "3rd", "96th") sit a few pt above their
   number's baseline — enough to clear line-grouping tolerance, so they formed
   an orphan one-word "line" that sorted to the WRONG position in the output
   ("since nd ranks T-2" instead of "ranks T-2nd"). Fixed by
   `snapSuperscriptOrdinals`, which searches by Y-locality first (NOT a
   page-wide x-sort — that was a real bug in an earlier draft of this fix, since
   a left margin repeats at the same x on many unrelated lines).
2. **`tidy()`'s hyphen-rejoin** (`X- Y` → `X-Y`, i.e. keeps the hyphen) is a
   DELIBERATE tradeoff, not a bug: some line-wrap hyphens are real/meaningful
   (e.g. "Chicago-NL" as the app's own interleague-disambiguation code) and some
   are pure wrap artifacts ("at-tend" should really be "attend"). Changing the
   default to always drop the hyphen would fix the artifact case but break the
   real-code case, and there's no reliable way to tell them apart with a regex.
   Left as-is; a stray hyphen in an otherwise-correct word is a much smaller
   problem than the word being silently truncated (the pre-fix state).

## Diagnostic tools (`.scratch/game-notes/`)

- `fetch-note.mjs <teamId> [out.pdf]` — pull a fresh PDF (not committed, re-fetch
  each session) from the URL already in `public/data/game-notes.json`.
- `verify-all.mjs` — runs `extractForTeam` over every calibrated club's PDF in
  `.scratch/game-notes/pdfs/` (must fetch first), dumps `{title, body}` to
  eyeball. Has a known quirk: it brute-force tries page 1 then page 2 for
  page-2-configured clubs, so a page-2 club can show WRONG (page-1) content in
  this harness even though the real app is fine — always double check with
  `verify-one.mjs <pdf> <teamId> <pageNum>` against the actual configured page
  before concluding something's broken.
- `dump-near.mjs <pdf> <page> "<substring>"` — raw x/y/font for every PDF item
  matching a substring, plus same-baseline neighbors. The go-to first move for
  "why did this word/phrase vanish or garble" — usually reveals the answer in
  one look (a font mismatch, an x past some cutoff, a stray decorative-font
  glyph, two items with a near-zero gap that should join with no space, etc).
- `column-scan.mjs` — per-club xMin histogram of body/head lines. A recurring
  cluster at some x = a real second column; isolated single counts = legitimate
  wrap variance. **Always run this before widening a columnMaxX** — the number
  it gives you (just under the real cluster) is the safe new value.
- `dropped-names-scan.mjs` — flags mixed-case bold runs sitting past the current
  columnMaxX, i.e. the "is this club dropping names" smell test.

Workflow for a new bug report: `dump-near.mjs` on the reported phrase to see the
raw geometry → if it's a columnMaxX issue, `column-scan.mjs` for the safe new
value → widen in `whatsBrewing.js` → `verify-one.mjs` to confirm the fix →
`verify-all.mjs` across ALL clubs to check for regressions → `npm run lint &&
npm run build` → commit.

## Running the debug page

`/game-notes-debug` (route wired in `src/lib/route.js` + `src/App.jsx`, screen at
`src/screens/GameNotesDebugPage.jsx`) — unlisted, linked from nowhere. Lists all
30 MLB clubs, calibration status + layout, most recent note date, and an "Open"
button that opens the real `WhatsBrewingModal`.

**Dev server gotcha**: a plain `npm run dev &` backgrounded via shell dies when
the shell session recycles between turns in this harness. Use the Bash tool's
`run_in_background: true` parameter instead (not a raw `&`) — that's tracked by
the harness itself and survives across turns. If the maintainer reports the page
"stopped working," it's almost always this — just restart with
`run_in_background: true` again.

## Remaining scope (per `CALIBRATION.md`, not started)

Once the GREEN-tier (12 `flow-bold` + Brewers `column` + Pirates `flow` = 14
clubs) review is fully done, the next phase is the **YELLOW tier** (11 clubs:
DET, ARI, CLE, CWS, BAL, SF, COL, SD, CHC, WSH, STL) then **RED** (5: TB, TEX,
TOR, ATL, CIN, harder templates, do last/maybe skip). `CALIBRATION.md` has the
per-club font/geometry read-off already done for those. Don't start that until
the maintainer says the GREEN-tier review is done — this session's whole focus
has been fixing what was already "shipped" before extending further.

**ARI (Diamondbacks, 109) jumped the queue** — the maintainer asked to check it
out mid-review, so it's now calibrated (out of YELLOW-tier order, ahead of the
other 10). It's a genuine two-column page-1 layout (`cfg.columns`, same shape
as NYY): col 1 x~18-236 (`HERE'S THE STORY`, `LAST GAME`, `RADIO UPDATE`, `IT
STARTS WITH STARTING PITCHING`, `TROY TAKING TO NL WEST`, `GARCIA HANGING
ZEROES`, `LOÁISIGA BLANKING FOES`, `FIRST-INNING TALLIES`), col 2 x~254-471
(`CARROLL SWIPING BAGS`, `WIN THE SERIES`, `VS. NL WEST`, `EL PIKE VS. NL
WEST`, `MORENO'S ON-BASE STREAK`, `GABI ON THE ROAD`, `ALL-STAR FACTS`, `VS.
DODGERS`). One new wrinkle worth remembering for the rest of YELLOW: a mixed-
case multi-word head-font run away from the margin (col 2's embedded
head-to-head table, headed "2026 All-Time Last 10 Streak") does NOT
self-exclude via `lineMarkerCutoff` the way an ALL-CAPS stray run does (that
function's marker test requires `isAllCaps`) — it needs an explicit
`bottomCutoff` instead. Verified against a fresh PDF via `verify-one.mjs
pdfs/109.pdf 109 1` and folded into `verify-all.mjs`'s regression set (now 15
clubs). A remaining, unexplored cosmetic quirk: ARI's raw PDF text already
contains a literal space inside a couple of "fi" ligatures ("fi rst", "fi
fth") — confirmed via `dump-near.mjs` to be baked into the source `str`, not
introduced by `joinWords` or `tidy()` — left as-is, same call as the hyphen
tradeoff above.
