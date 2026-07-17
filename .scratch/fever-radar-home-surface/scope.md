# Fever radar on the home page — explored, not pursuing

**Status:** wontfix — tried (including a working implementation), rejected after review. Record kept so a future session doesn't re-propose this shape from zero.

## The ask

Fever Baseball's breakout/cooling radar already ships as a quiet, tap-to-reveal
glyph on individual lineup rows (`RadarPill.jsx`, wired in `TeamInfo.jsx`). The
original idea: surface the same data on the home page (`GameSelect.jsx`) so a
user picking a game for the night also sees who's trending, without first
drilling into a specific team's lineup.

## What was actually done

1. **Design research + a 4-variant static mockup** (Artifact), grounded in the
   real design tokens/copy voice and a real `fever-radar.json` sample:
   - **Agate Board** — dense two-column Breakout/Cooling list, page-header or
     side-rail placement.
   - **Ticker Strip** — horizontal wire-tape scroll.
   - **Compact Chips** — truncated row, "+N more."
   - **Card-Attached** — no standalone widget; instead, a small strip
     conditionally bolted to the bottom of any individual `GameCard` whose own
     roster has a hit (mirrors the existing `.gamecard__prospects` badge).
2. **Two independent critical audits** (separate agents, blind to each other)
   of the 4-variant idea. Both converged hard:
   - `movement` is null on every entry in the live snapshot, and
     `dataThrough` already lags `generatedAt` by ~5 days — a "trending"
     framing oversold data that couldn't show trend.
   - A "top 5 / top 5" leaderboard is an ordering, full stop — `RadarPill`
     already fought to *remove* its own board-rank number as a false-precision
     claim; sorting-without-printing-the-number just relocates that problem.
   - The wide-viewport rail one variant leaned on ("mirrors `PastDayRecapBox`")
     turned out to only exist when `finals.length > 0` (a past/all-final day)
     — false for the ordinary live-slate case, i.e. the actual premise didn't
     hold.
   - `src/api/CLAUDE.md` / `gen-fever-radar.mjs`'s own header state Fever is
     kept **off** the callouts worthiness table and attributed only via
     `RadarPill` *because* it's a third-party model bbsbh "can't reconcile
     against the official record." Putting it on the home page — even
     conditionally — reopens that boundary rather than just extending a UI
     pattern.
   - Both independently rated **Card-Attached the least-bad of the four** (no
     fabricated ranking, degrades to nothing on MiLB/no-hit games by
     construction) — but both also flagged that even Card-Attached doesn't
     fully resolve the positioning question above, just shrinks it.
3. **Real implementation of Card-Attached**, in an isolated worktree off
   `origin/main` (never merged): `GameCardRadarStrip.jsx`, a shared
   `lib/radarVoice.js` (deduping the plain-text voice bank out of
   `RadarPill.jsx`), and the roster-cross-reference wiring in `GameSelect.jsx`
   (reusing the same `fetchRosterEntriesForTeams` join the MiLB prospect-count
   badge already does). Verified live — lint/build clean, driven with
   Playwright against the real dev server and a real slate (rosters, Fever
   snapshot, the works).
4. **Two rounds of visual iteration** on user feedback: a team-color dot
   (ambiguous between similarly-colored clubs, e.g. Yankees/Dodgers navy) →
   replaced with a dark-graphite "POS · TEAM" pill → replaced again with
   plain inline text reusing the League Leaders board's own two typographic
   roles (`.tlead__pos`, `.tlead__rowteam`), since the pill read as an
   off-brand shape nothing else on `.gamecard` uses.

## Why it's not shipping

After seeing the fully-wired, visually-settled version live: it wasn't adding
enough value on a screen whose job is "help me pick a game to watch." This
matches the open question neither audit could close even for the
least-invasive variant — the data is still a third-party opinion appearing
unprompted on the home screen, and no amount of visual restraint fixed that
the payoff didn't clear the bar. Direct user call, not a technical blocker.

`RadarPill` on the lineup row is unaffected and stays as-is — this only
concerns the home-page/game-card surface.

## One separate, unresolved thread worth keeping

A research pass (independent of the placement question above) found that
Baseball Savant already publishes the data needed to compute bbsbh's **own**
version of this signal — `est_woba_minus_woba_diff` on Savant's Expected
Statistics leaderboard (`baseballsavant.mlb.com/leaderboard/expected_statistics`,
CSV export, CORS-open, same pattern `gen-savant-percentiles.mjs` already uses)
— rather than depending on Fever's lagged snapshot. That would turn this from
an "unreconcilable third-party opinion" into a first-class, reconcilable bbsbh
derivation (eligible for the callouts table, per `docs/callouts.md`'s own
rubric), fix the stale/null-`movement` problem, and cost roughly one new
`gen-*.mjs` script (~150 lines, sibling to the existing generator).

That's a genuinely different proposal from "put Fever on the home page" — it's
about *owning the metric*, not *where it's displayed*. Worth its own scoping
pass if this comes up again, but it does NOT by itself answer whether this
belongs on the home screen at all; that's the part that stalled here.
