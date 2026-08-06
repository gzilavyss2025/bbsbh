# Video highlights cascade — box score → team → player

## Problem

`src/api/highlights.js` already fetches MLB's per-game `content` endpoint and
joins clips to plays inside the box score (`HighlightSheet.jsx`, per-at-bat
"▶ Watch" button). This PRD scopes the next layer: surfacing a filtered,
**team-relative positive** subset of those same clips on the Team hub's Games
tab and on individual player pages — cascading the same data outward instead
of leaving it locked to the single game it aired in.

## Locked schema (verified live against 45 real clips over 5 games, PLUS a
full-season sweep of every 2026 Brewers clip crediting Joey Ortiz — 52 clips,
117 games)

A per-play clip's `keywordsAll` already carries everything needed; no WPA, no
`play.matchup` join, no computed sentiment:

```
{
  guid,          // == playId in feed/live, for in-game placement only
  playerId,      // credited subject (keywordsAll `player_id`)
  teamId,        // credited team (keywordsAll `team_id`) — IS the sign,
                 // EXCEPT for abs/challenge-taxonomy clips, see below
  category,       // hitting | pitching | defense (keywordsAll taxonomy)
  significance,  // whichever of: wow, top-play, featured, player-of-the-game,
                 // star-of-the-game, clutch-moment, highlight-reel-*,
                 // career-first, season-first, milestone, mlb-debut,
                 // gold-glove-award is present
}
```

"Positive for team X" = `teamId === X`, for ordinary hitting/pitching/defense
clips — confirmed on non-obvious cases too (every strikeout clip tags the
pitcher's team, never the batter's; a game-ending defensive-play headline
naming the fielder was tagged to the pitcher of record instead, but the team
tag was still correct).

**Amendment from the full-season sweep: the sign heuristic breaks for
`abs`/`challenge`-taxonomy clips and rule-violation clips.** "Timer violation
on Joey Ortiz" and "Strike 2 call confirmed after ABS challenge" (a challenge
his own team LOST) both tag `teamId: 158`, even though both are bad for
Ortiz/Milwaukee — these clips are tagged by whose plate appearance or pitch
it was, not by who benefited, and "confirmed" (lost) vs. "overturned" (won)
only exists as English prose in the headline, not a clean field. **Rule:
exclude any clip carrying `abs` or `challenge` in its taxonomy from the
positive-highlights filter entirely** — we don't parse headline text to
recover sentiment. Every ordinary hitting/pitching/defense clip in both
samples still holds the original rule; this exclusion is narrow and specific.

"Play of the game" = `significance` includes `player-of-the-game` /
`star-of-the-game` / `featured`, present in 3 of the 5 sampled games — shown
when present, no synthetic substitute when absent.

## Surfaces

### 1. Box score (`screens/BoxScore.jsx`) — one addition, one open question

Per-play "▶ Watch" buttons already exist inside `PlayByPlay.jsx`'s `AtBatCard`,
reveal-only. **New:** a "Play of the Game" card at the top of the revealed box
score, rendered only when the game's content items include a
`player-of-the-game`/`star-of-the-game`/`featured` clip — same `SealBox`
reveal-render footing as the rest of the box score (ADR-0001/0002), no new
spoiler surface since it's already inside the seal.

**Decided: give the button a real thumbnail too, for consistency with the
rails below.** The existing per-play button is currently plain text, no
poster — documented in
`.scratch/video-highlights/issues/01-highlights-bottom-sheet.md` as a spoiler
concern ("a poster frame is itself spoiler-shaped"). That reasoning doesn't
hold (see memory: highlight-poster-not-actually-a-spoiler) — the button only
ever renders on an already-revealed play, whose result is already shown in
text on the same card, so a poster adds no new information. Since the rails
now show real thumbnails, the box score gets one too rather than being the
one inconsistent surface.

**This is a change to already-shipped code, not just new work** — the
per-play button in `AtBatCard` exists today and renders plain text; adding a
poster there is a follow-up issue against the ORIGINAL video-highlights
feature (own worktree/branch, own spoiler-audit re-check — confirm the
`SealBox` reveal-render gate still fully covers the poster image the same way
it covers the button today), not something this PRD's issue breakdown should
quietly fold in as if it were part of the new work.

### 2. Team hub → Games tab (`screens/team/GamesTab.jsx`)

New `TeamHighlightsRail`, same shape and cost as the existing
`TeamPhotosRail`: walks the tab's already-loaded `seasonGames` (decided games,
already `asOf`-cutoff-filtered) backward from newest, fetching
`fetchHighlights(gamePk)` per game on demand, filtering to `teamId === this
team`. No precompute, no new index file — reuses the exact walk-back pattern
Photos already validated.

### 3. Player page (`screens/PlayerPage.jsx`)

New `PlayerHighlightsRail`, filtering to `playerId === this player`,
**scrollable and full-season**, not bounded to a recent-games window.

**Revised from the original "last N games" plan.** A full-season sweep for
Joey Ortiz found real gaps of up to 12 consecutive days (most recently
2026-07-22 → 2026-08-03) with zero credited clips — a "last 10 games" window
would very plausibly render an empty rail on a day when 48 real clips exist
just outside that window. The data doesn't support a recency-bounded rail;
it supports "all of it, a few at a time in a scroller."

That in turn means this can't be a live per-page-view walk the way the team
rail is — fetching ~115+ games' worth of content on every visit to a player
page is not viable on a phone. **This surface now requires the nightly
precompute** originally deferred (see Precompute shape, below) — the open
cross-game-index problem `gamePhotos.js`'s own docs flagged is no longer
avoidable for this surface, it just moved from "v2 nice-to-have" to "what v1
actually needs."

## How it operates (mechanics)

- `fetchHighlights(gamePk)` (+ `keywordsAll` inspection) is reused as-is —
  no new statsapi call shape. The team rail still fetches it live, on demand,
  same as Photos. The player rail needs a **nightly precompute** instead — see
  below; this is a new piece, not a reuse of an existing mechanism.
- No new spoiler classification — the per-play box-score button stays
  reveal-only exactly as it is; the team/player rails are **decided games
  only** (the same "already public, no in-game state" footing Photos already
  established, restated per this PRD's earlier discussion: outside the game
  feed itself, a browsing user has accepted the reveal).
- `abs`/`challenge`-taxonomy clips are dropped from the positive-highlights
  filter at the source (see schema amendment above) — this applies identically
  wherever the filter runs, live (team rail) or precomputed (player rail).
- MLB only, same as `highlights.js` today — off-MLB games return `[]`, so
  MiLB team/player pages simply show no rail (`showHighlightsRail` gate,
  mirrors `hasWhatsBrewing`/`showRookiePill`'s MLB-only pattern).

### Precompute shape (team + player rails) — decided

Both rails read the SAME precomputed data; the earlier "team rail = live walk"
plan is superseded.

- **Scan by game, not by team or player.** Each game belongs to two teams;
  scanning per-team schedules would double-fetch the same game's `content`
  for nothing. One nightly pass over newly-finished MLB games, one
  `fetchHighlights(gamePk)` call per game, each resulting clip filed under
  both its `teamId` and `playerId`.
- **One small file per team**, not one league-wide file — a clip lives under
  whichever team it was tagged to AT THE TIME, which handles a mid-season
  trade correctly for free (pre-trade clips stay filed under the old team).
  Rough sizing off the Ortiz numbers (~50 clips/season for a regular, 26-man
  roster): each team file lands roughly 150-400KB, well under the size that
  put `vs-team-splits.json` outside the PWA precache.
- **Team rail** reads its own team's file directly. **Player rail** reads the
  file for the player's CURRENT team and filters to his own `playerId`
  client-side — a trade means his pre-trade clips from the old club won't
  surface on his page. Accepted trade-off, not solved in v1.
- **Incremental, append-only refresh** — same shape as
  `gen-umpire-accuracy.mjs`: each night, scan only games finished since the
  last run, dedup by `gamePk`. A separate, hand-run one-time backfill script
  (shape of `gen-rookies-backfill.mjs`) populates the rest of the season once.
- **Known lag:** the box score's own per-play clips and "Play of the Game"
  card stay live (unaffected, single-game fetch at reveal time), but a game
  finishing tonight won't reach the team/player rail until the next nightly
  run — same lag every other precomputed feature in this app already
  accepts (WAR, comeback wins, etc.).
- The `abs`/`challenge` exclusion (see schema) is applied INSIDE the
  generator, not the reader — the shipped JSON only ever contains clips
  already past that filter, so `TeamHighlightsRail`/`PlayerHighlightsRail`
  stay dumb readers with no filtering logic of their own to keep in sync.

## Drawbacks / open risk

- **Coverage is sparse and uneven.** MLB clips what's "highlight-worthy," not
  every play — a bench player who draws a walk in a blowout will very often
  have an empty rail. This isn't a bug to fix, it's the nature of the source;
  needs a real empty state on both team and player surfaces, not a loading
  spinner that never resolves.
- **No magnitude ranking without a significance tag.** A garbage-time solo
  homer in a 10-1 game and a series-defining go-ahead single carry the same
  schema shape unless MLB also tagged one `clutch-moment`/`wow`/`top-play` —
  and that only happened on roughly half the sampled clips. Rail ordering
  (chronological vs. "best") is unresolved by this schema alone.
- **The sign heuristic has one confirmed blind spot, and is still unverified
  beyond it.** The full-season Ortiz sweep found real counterexamples —
  `abs`/`challenge` and rule-violation clips tag the participant's team
  regardless of whether the outcome helped or hurt them — now excluded by
  rule (see schema). But that sweep was still ordinary regular-season play;
  we have zero examples of ejections, brawls, or injury clips in either
  sample. If MLB ever tags a moment that's technically true but not
  something a team wants surfaced (e.g. a benches-clearing incident under
  `rivalry`), there is no override mechanism in this design — bbsbh would
  surface exactly what MLB tagged, unfiltered by our own judgment, for any
  category we haven't already found and excluded.
- **We have no recourse if MLB retags or removes a clip.** Retention window
  and edit history of `content` items are unverified; a rail built today
  could show a broken player on playback weeks later with no detection.
- **No cross-surface dedupe.** The same clip can legitimately appear in the
  box score, the team rail, and the player rail simultaneously. Not a bug,
  but a real "haven't I seen this" redundancy this PRD doesn't solve.
- **MLB-only is a visible inconsistency**, not just an absent data source —
  a MiLB player/team page is otherwise structurally identical to its MLB
  counterpart, and this section will simply not exist there, same as
  `pitchArsenal.js`/`savantPercentiles.js` today.
- **Added page weight.** Team and player pages already carry Photos,
  Fever radar, WAR, pitch-mix, similarity cards; a highlights rail is another
  per-page fetch + another embedded-video surface competing for the same
  screen and the same phone bandwidth budget.
- **The player rail now depends on a nightly precompute succeeding.** Unlike
  the team rail (live, self-healing on next page load), a broken or
  overrunning nightly job means a stale or empty player rail until the next
  successful run — same operational risk class as the WAR cron's own recent
  403 outage (see `war.json` refresh incident), not unique to this feature
  but a new surface exposed to it.

## Non-goals for v1

- No manual curation/override UI for a mistagged or unwanted clip.
- No cross-surface dedupe.
- No magnitude-based ranking beyond significance-tag presence/absence.
- No MiLB fallback of any kind.
- No recap/condensed-game/interview/press-conference integration — tracked
  separately, parked (see memory: video-highlights-adjacent-content).

## Blocklist hook — decided: stub it in now, empty

**Decision: yes, build the hook even with nothing in it yet.** Expect this to
need real entries later — the sign heuristic already needed one correction
(`abs`/`challenge`) after the very first full-season sweep, and we've
explicitly never seen an ejection/brawl/injury clip in either sample.

Shape: a hand-maintained `scripts/highlight-blocklist.json` — a flat list of
`{ guid, reason }` — same "edit the seed, never the output" convention as
`milb-history-seed.json`. `gen-highlights.mjs` checks every clip against it
and drops a match BEFORE writing the per-team file, same layer as the
`abs`/`challenge` exclusion — one filtering pass, one place a maintainer
looks, readers stay dumb. Starts as `[]`; the mechanism existing costs
nothing, and means the day something needs pulling, it's a one-line JSON
edit + next cron run, not a code change.

## Rail ordering — decided

**Newest first, anchored to the right.** The rail reads like a timeline:
the most recent clip sits at the far right edge, and scrolling LEFT moves
backward through the season — the opposite of this app's other horizontal
rails (which put newest on the left). One implementation wrinkle this
creates: a scroll container starts at `scrollLeft: 0` (its left edge) by
default, so without an explicit on-mount scroll-to-end, a visitor would see
the OLDEST clip first, backwards from the intent. `TeamHighlightsRail` /
`PlayerHighlightsRail` need to scroll themselves to their far edge on mount
(and after each data load, since the file loads async) rather than relying
on default browser scroll position.

## Open questions for the maintainer

None outstanding — all three from the original wireframe are resolved above
(precompute shape, blocklist hook, rail ordering). Ready to move to
implementation planning / issue breakdown when desired.
