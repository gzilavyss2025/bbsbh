# Expert scorekeeper review — findings & triage

Status: implemented (A5, A6 deferred)
Written: 2026-07-18

## Implementation status (2026-07-18)

Shipped in this branch and verified against real game feeds (anchor 823035,
triple play 778442, cycle 778501):

- **A1** — `scorebookCode` now emits `SF{n}` for sac flies and `SAC {chain}` for
  sac bunts; the cycle game's sac fly renders `SF7`, no more `8U`.
- **A2** — a strikeout where the batter reaches is now a REACH code (`K WP` /
  `K PB` / `K E2`) over a diamond that shows him aboard, not a lone `K` over a
  safe diamond.
- **A3** — GIDP/triple-play batters get `DP`/`TP` on their own card (`DP 4-3`,
  `TP 4-3` confirmed).
- **A4** — unearned runs are circled on `PlayDiamond` (`earned` threaded from the
  scoring runner's feed flag; Butler / Kelly / Tucker confirmed unearned, no
  false positives in the all-earned game).
- **A7** — the ScorecardSheet renders one row per slot occupant (starter + a
  sub-line per substitute), each with its own name and AB/H/R/RBI line.
- **A8** — the blank template's inning count is a prop (`templateInnings`), no
  longer a hardcoded 11.
- **A9** — new "By inning" digest on the box score (Pitches / Whiffs / LOB per
  half), all plain play-by-play so it survives at MiLB parks.

Deferred by request: **A5** (per-batter BB/SO on the box line) and **A6**
(BB/SO/LOB columns on the paper scorecard).

A working baseball scorekeeper's review of Tally Baseball (MLB + MiLB), driven
by the actual scoring logic (`src/api/playbyplay.js`, `loadScorecard.js`,
`derive.js`, `pitchers.js`, `linescore.js`) and the two rendered scoring
surfaces (the live at-bat cards in the innings view, and the full-reveal
Scorecard Lab grid + box score). Each point below was then verified against the
code by a second pass — verdicts, `file:line` evidence, severity, and effort are
recorded. Checked against `.scratch/*` and `docs/enhancement-proposals.md`:
nothing here is already tracked.

---

## What the app gets right (a scorekeeper's take)

The scorebook notation engine is unusually faithful for a companion app. It
already nails the things most apps get wrong: unassisted putouts (`3U`, not a
bare `3`), the backwards "looking" K only on a *called* third strike, foul-catch
codes (`FP3`/`FF7`), out attribution to the correct *earlier* card when a lead
runner is doubled off (not the card of the play where the out physically
happened), pinch-runner aliasing so a courtesy-runner's later baserunning flows
onto the batter's own diamond, per-leg advance codes with the driving hitter's
lineup slot, correct DP/CS/PK/FC/TP runner tags, and inherited-runner charging
via `responsiblePitcher` for earned runs. The extra-innings and reveal model is
disciplined. This is a strong base — the criticisms below are fidelity gaps at
the edges, not foundational problems.

---

## Pointed criticism (by scorekeeping domain)

### A. Scoring-notation fidelity — the live at-bat card

**A1 (CONFIRMED bug, HIGH). A sacrifice fly is penciled as `8U`.** This is the
sharpest finding. `scorebookCode` (`src/api/playbyplay.js:402-436`) has no
`sac_fly`/`sac_bunt` case. A sac fly's MLB description — "hits a sacrifice fly to
center fielder…" — does **not** contain "flies out/into", so it slips past the
fly/pop/line regex (`playbyplay.js:430`) and lands in the single-fielder branch,
which stamps `${chain[0]}U` = **`8U`** (`playbyplay.js:434`). To a scorekeeper
`8U` reads as an *unassisted infield out* — exactly wrong for a fly ball the
center fielder caught (`F8`/`SF-8`), and it hides that the PA is not an at-bat.
`sac_bunt` has the same disease (renders as a bare `1-3`/`3U` with no `SH`/`SAC`
marker). Notably the full-reveal Scorecard Lab grid *does* classify these
(`loadScorecard.js:112,115` → `FO`/`SAC`; `NON_AB_EVENTS` excludes them from AB),
so **the two surfaces already disagree**, and even the lab grid's diamond-center
still shows the wrong `8U` because it reuses `atbat.code` (`AtBatBox.jsx:45`).
The scoring runner's leg is fine (`advanceCode` maps `sac_fly:'SF'` at
`playbyplay.js:444`) — only the *batter's own top code* is wrong. Fix is
localized to `scorebookCode`.

**A2 (CONFIRMED, MED). A strikeout where the batter reaches shows a lone `K`
over a safe-at-first diamond.** `scorebookCode` returns `{code:'K'}` for any
strikeout with no check on whether the batter was actually retired
(`playbyplay.js:418-421`). On an uncaught/dropped third strike (or K+WP/PB) the
batter's `movement.isOut` is false, so no out number is set and the advancement
walk shades him on first — the card then shows a centered K/backwards-K over a
diamond that says he's safe. Internally contradictory, and indistinguishable
from a routine strikeout. A scorer writes `K` **plus** `WP`/`PB`/`E2` and rings
the reach.

**A3 (CONFIRMED, LOW). The GIDP batter's own card carries no DP marker.** He
gets the bare chain `6-4-3`; only the *erased runner* is tagged `DP`
(`runnerOutCode`, `playbyplay.js:544,560`). The lab grid disagrees again
(`classifyOut` → `DP`, `loadScorecard.js:111`). Scorekeepers mark the batter's
box too.

**A4 (CONFIRMED, LOW-MED). Unearned runs are never marked in the innings view.**
`pitchers.js:86` reads `md.earned` correctly for the ER column, but the
earned/unearned bit never reaches the diamond — `finalizeTrip` sets only
`scored` (`playbyplay.js:744`) and `PlayDiamond` has no earned flag. Scorers
circle unearned runs; nothing here distinguishes them. All data is already
reveal-only, so no new spoiler surface.

### B. Box score & paper scorecard completeness

**A5 (FEATURE, MED). The per-batter box line is AB/R/H/RBI only** — no BB, no
SO (`BoxScore.jsx:507-543`). Deliberate per the code comment (#22 batter-totals
order), but MLB.com and a real scorebook line both carry BB and SO per batter,
and the underlying stats are already in `selectBoxscore`. This is the
highest-value gap because it works at **every** level, MiLB included.

**A6 (FEATURE, MED). The paper ScorecardSheet summary is AB/H/R/RBI only** —
no BB/SO/LOB columns (`ScorecardSheet.jsx:17`; tallies at `loadScorecard.js:165-168`).

**A7 (FEATURE/LIMITATION, MED). Nine fixed rows, no substitute sub-lines.** The
sheet has exactly 9 rows (`ScorecardSheet.jsx:18`) and the left column shows only
the starter (`:72-73`); a sub is flagged only by a `subBefore` rule inside a cell.
Both occupants of a slot share the starter's single name label — a scorekeeper
can't read *who* pinch-hit for whom. A paper #22 gives each sub its own sub-line.

**A8 (MINOR, LOW). The blank template is hardcoded to 11 innings**
(`ScorecardSheet.jsx:16`). Loaded games are unaffected (columns come from the
grid), so this only bites the empty printable template past the 11th.

### C. MiLB (the review explicitly covers minor-league scorekeeping)

**A9 (ASSESSMENT). MiLB thins the box score by design** — Statcast
superlatives, win probability, three stars, ABS challenges, and umpire accuracy
all correctly vanish where there's no tracking data. That's honest degradation,
not a bug. But the highest-value MiLB wins aren't new data sources — they're
A1/A5/A6 plus a pitch-count/whiff/LOB-by-inning digest derivable from
`playEvents` with no tracking data at all. Fix those and the MiLB scorer's
experience improves the most.

---

## Triaged backlog

### Bug issues to check (ranked)

1. **A1 — Sac fly/sac bunt mis-notated (`8U`, bare chain).** `playbyplay.js:434`.
   Add `sac_fly`→`SF`/`F{pos}` and `sac_bunt`→`SAC`/`SH` branches; have both the
   live card and the lab grid read one source. HIGH · effort S · no spoiler impact.
2. **A2 — Strikeout-reached shows plain `K` over a safe diamond.**
   `playbyplay.js:418`. Detect batter-not-out on a strikeout and annotate the
   reach (WP/PB/E). MED · effort S–M · no spoiler impact.
3. **A3 — GIDP batter card lacks a DP marker.** `playbyplay.js` (fall-through).
   Bundle with A1 (same function, same surface-split). LOW · effort S.
4. **A8 — Blank template capped at 11 innings.** `ScorecardSheet.jsx:16`.
   LOW · effort S (trivial).

### Feature improvements (ranked)

1. **A5 — Add BB + SO to the per-batter box line.** `BoxScore.jsx:507-543`;
   stats already in `selectBoxscore`. Works at every level. MED · effort S–M.
2. **A4 — Mark/circle unearned runs in the innings diamonds.** Plumb the scoring
   runner's `earned` (already read at `pitchers.js:86`) into `PlayDiamond`.
   LOW-MED · effort M.
3. **A6 — Add BB/SO/LOB columns to the paper ScorecardSheet.**
   `ScorecardSheet.jsx:17` + new per-slot tallies in `scorecardPlays`. MED · effort M.
4. **A9 — MiLB pitch-count / whiff / LOB-by-inning digest.** Derivable from
   `playEvents` without tracking data — the one genuinely new MiLB-available
   enrichment. LOW-MED · effort M.
5. **A7 — Dedicated substitute sub-lines in the ScorecardSheet.**
   `ScorecardSheet.jsx:68-88`. Legibility win, but a structural row redesign.
   MED · effort L.

### Cross-cutting note (do this before A1/A3)

The live play-by-play card renders out notation straight from
`scorebookCode.code`, while the lab grid **re-derives** a parallel corner label
via `classifyOut` (`loadScorecard.js:107-117`). Two paths that already disagree
on sacrifices and DPs and will keep drifting. The right fix for A1/A3 is to make
`scorebookCode` emit the sacrifice/DP marker **once** so both surfaces read it —
not to patch `classifyOut` in parallel (and if `classifyOut` stays, give it an
`SF` case so its corner stops reading `FO` on a sac fly).

### Not tracked elsewhere

Verified against every `.scratch/*` feature dir and all of
`docs/enhancement-proposals.md` (its 5 proposals + the "set aside" list) — none
touch scoring-notation fidelity or per-batter box columns. Everything above is new.
