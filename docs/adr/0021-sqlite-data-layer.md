# SQLite is the authoring layer for generators that need to join

bbsbh grew from a handful of `gen-*.mjs` generators to 15+, each maintaining
its own bespoke per-topic JSON file with hand-rolled merge/append logic. That
strained in one specific, recurring way: a combined view across two files
means writing another one-off JS merge function. The clearest example already
in production was `src/api/seasonGradeFormula.js` + `teamScore.js`, which
loop over all 30 teams doing a manual nearest-date lookup across
`team-score.json` and `season-score.json` on every render.

`gen-game-score.mjs`, `gen-team-score.mjs`, and `gen-season-score.mjs` now
write into a shared SQLite database (`scripts/lib/schema.sql`,
`scripts/lib/db.js`) instead of hand-rolling their own JSON read-merge-write
cycle, then export the exact same reader shapes `src/api/gameScore.js` /
`teamScore.js` / `seasonScore.js` already expect — this is purely an
authoring-side change; no client code moved. "No backend" (root `CLAUDE.md`)
holds: everything still happens at generation time in GitHub Actions, the
client still reads static same-origin JSON, and Vercel's build never touches
SQLite.

**Runtime**: `node:sqlite` (built into Node ≥22.5, stable since Node 26),
not `better-sqlite3`. The nightly and game-score workflows run
`node scripts/gen-*.mjs` directly with no `npm install` step; a built-in
avoids adding install latency to the 10-minute game-score cron and avoids
native-binary platform risk.

**Source of truth is TEXT, not binary.** Each generator reconstitutes an
in-memory database from a committed `.sql` dump (plain `INSERT` statements),
writes to it, then re-dumps. A binary `.db` file doesn't delta-compress in
git the way text does, and a solo-reviewed project loses real value if a PR
diff becomes unreadable — this project already prunes callouts and
season-chunks team-transactions specifically to keep the repo small, so
trading readable diffs for a binary blob would cut against that precedent,
not with it.

**Dumps are split one file per table-group, not one shared file**, because
`game_scores` and `team_snapshots` are written by generators on
independently scheduled crons (every 10 minutes vs. once nightly). A single
dump fully rewritten on every run would let whichever workflow pushes second
silently overwrite the other's table with a stale copy — `scripts/data/
game-scores.sql` and `scripts/data/team-snapshots.sql` restore the same
per-file isolation the all-JSON setup had, so the existing push-collision
retry logic in `update-game-score.yml` keeps working unchanged.

A `season_grade` SQL view exists for future generation-time features but is
deliberately **not** wired in to replace `leagueSeasonGradesFor`: that
function computes a grade at a dynamic, per-page spoiler-safe cutoff, and
`seasonGradeFromScores` also runs live for the Team Page's interactive "how
this is calculated" explainer — both need the raw dated snapshots and the
pure formula in the browser. A precomputed static grade would either miss
historical cutoffs or break the explainer.

**Scope**: only the three generators with a live cross-file join problem
moved. Large, stable, non-joining files (`vs-team-splits.json`,
`umpires.json`, `rookies.json`, `manager-history.json`, `war-history.json`,
`milb-history.json`) stay JSON — no join need today, migrating them would be
pure risk for no payoff. A follow-up decision, not yet made, is whether to
retain fired-callout history as a small ledger table (today's raw callout
fuel is deliberately pruned after ~10 days, a code comment only —
`scripts/gen-callouts.mjs`). **Not** a small tweak to `gen-callouts.mjs`
itself: `callout-notes.js`'s scoring functions take an actual at-bat/play as
input alongside the precomputed bundle, and `gen-callouts.mjs` runs *before*
that night's games are played — a real ledger needs its own post-game
generator (structurally like `gen-game-score.mjs`: its own cron, fetches
each newly-Final game's completed feed, replays it through the scoring
functions). Deferred as its own decision, not started here.

The shelved Game Notes Insights spike (`.scratch/game-notes/
INSIGHTS-EXPLORATION.md`, draft PR #196) lands directly in this schema
(`game_notes_insights`) rather than as another bespoke JSON file — see the
Phase 2 follow-up.
