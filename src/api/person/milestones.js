// Milestone watch — forward-looking countdown to a round career-total
// milestone, the complement to Firsts (gameLog.js, which looks backward). See
// ../person.js's header for the module's overall spoiler footing.

import { num } from './shared.js'
import { aggregateSplits } from './stats.js'

// ---------------------------------------------------------------------------
// Milestone watch — forward-looking countdown to a round career-total
// milestone, the complement to "Firsts" above (which looks backward). Reads
// off the same aggregateSplits()-shaped stat object every other section of
// this file uses — `hits`/`homeRuns`/`rbi`/`runs`/`stolenBases`/`doubles` for
// hitting, `wins`/`strikeOuts`/`saves` for pitching. `window` is the
// player-page "worth mentioning" distance (wide — weeks out is fine);
// `gameGate` is the tighter single-game-plausible distance the nightly
// callouts precompute (gen-callouts.mjs) uses for its lineup-staging note.
// Both windows are a first cut — hits/HR/300-win/3000-K are well-worn
// milestone conventions, RBI/runs/SB/doubles less so.
// ---------------------------------------------------------------------------

// `window` is the player-page "worth mentioning" distance (tight — this
// season or next). `farWindow` is the wider distance the league-wide
// Milestone Watch page (a dedicated page, not a one-line aside) uses instead,
// covering a player who's a couple of full seasons out rather than just the
// next few weeks.
export const MILESTONE_DEFS = [
  { stat: 'hits', group: 'hitting', label: 'H', thresholds: [1000, 1500, 2000, 2500, 3000, 3500, 4000], window: 50, farWindow: 400, gameGate: 4 },
  { stat: 'homeRuns', group: 'hitting', label: 'HR', thresholds: [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 762], window: 15, farWindow: 120, gameGate: 2 },
  { stat: 'rbi', group: 'hitting', label: 'RBI', thresholds: [1000, 1500, 2000], window: 50, farWindow: 400, gameGate: 4 },
  { stat: 'runs', group: 'hitting', label: 'R', thresholds: [1000, 1500, 2000], window: 50, farWindow: 400, gameGate: 4 },
  { stat: 'stolenBases', group: 'hitting', label: 'SB', thresholds: [300, 400, 500], window: 20, farWindow: 150, gameGate: 2 },
  { stat: 'doubles', group: 'hitting', label: '2B', thresholds: [400, 500, 600], window: 20, farWindow: 150, gameGate: 2 },
  { stat: 'wins', group: 'pitching', label: 'W', thresholds: [100, 150, 200, 250, 300], window: 5, farWindow: 60, gameGate: 1 },
  { stat: 'strikeOuts', group: 'pitching', label: 'K', thresholds: [1000, 1500, 2000, 2500, 3000, 3500, 4000], window: 50, farWindow: 400, gameGate: 8 },
  { stat: 'saves', group: 'pitching', label: 'SV', thresholds: [100, 200, 300, 400, 500, 600], window: 15, farWindow: 120, gameGate: 1 },
]

// The league-wide Milestone Watch page's inclusion floor: only flag a chase
// once the player already has at least this FRACTION of the milestone. The
// distance-based `farWindow` alone isn't enough on the small-threshold stats —
// it's a flat 120 for saves and HR, wider than the 100-save / 100-HR clubs
// themselves, so it would sweep in every reliever with a couple of saves and
// every 40-homer bat as "chasing 100". A player 75%+ of the way there is a
// genuine chase; below that it's just noise on a page that already lists most
// of the league. (Non-binding on the player-page card, which uses the tight
// `window` — within `window` of any threshold already implies ≥85% of it.)
export const MILESTONE_PROGRESS_FLOOR = 0.75

// The smallest threshold still ahead of `value`, only when within `window` of
// it — otherwise null (too far out to be worth flagging, or already passed
// every threshold in the table). Also null below the FIRST threshold's own
// distance, i.e. `value <= 0`: a wide `farWindow` can otherwise exceed a
// stat's lowest threshold (100 HR's farWindow of 120 is wider than 100
// itself), which would flag a player who hasn't recorded a single one yet as
// "in range" of his first milestone — worth nothing until he's actually
// started the count. `minFraction` (default 0, off) is the league-wide page's
// additional progress floor (see MILESTONE_PROGRESS_FLOOR): require the value
// to be at least that fraction of the next threshold, dropping barely-started
// chases the wide farWindow would otherwise admit.
export function nearestMilestone(value, thresholds, window, minFraction = 0) {
  const v = num(value)
  if (v <= 0) return null
  const next = (thresholds ?? []).find((t) => t > v)
  if (next == null) return null
  if (v < minFraction * next) return null
  const remaining = next - v
  return remaining <= window ? { threshold: next, value: v, remaining } : null
}

// Every stat family in `group` currently within striking distance of its
// nearest milestone, nearest-first. Always an array — [] (never null) when
// nothing's in range, so callers can render unconditionally with no
// empty-state branch, matching this file's convention elsewhere.
export function milestoneWatchView(stat, group) {
  if (!stat) return []
  return MILESTONE_DEFS.filter((d) => d.group === group)
    .map((d) => {
      const m = nearestMilestone(stat[d.stat], d.thresholds, d.window)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)
}

// ---------------------------------------------------------------------------
// Milestone Watch projection — how soon a player chasing a career-total
// milestone is likely to reach it. Two-stage, deliberately conservative:
//
// 1. THIS season — his rate-per-game so far, times how many of the team's
//    remaining games he can be expected to actually play in. That second
//    factor is the whole point: naively dividing the milestone gap by the
//    team's games remaining would have a #5 starter "on pace" to pitch every
//    day, or a bench bat racking up the games he never sees. Scaling by his
//    OWN games-played share of the team's games-played-so-far keeps a
//    part-timer's projection honest in both directions.
// 2. Beyond this season — a recent-seasons career rate stands in, and per
//    the product ask, a future-season answer is only ever a YEAR (never a
//    fabricated date), since projecting a specific game two years out would
//    be false precision.
//
// Pure and side-effect-free so the nightly generator (scripts/gen-milestones.mjs)
// and any future caller share one implementation.
// ---------------------------------------------------------------------------

// Below this many games played this season, an in-season rate is too small a
// sample to trust (a September call-up's hot week isn't a real pace) — skip
// straight to the career-rate projection instead of overstating his pace.
const MIN_SEASON_GAMES_FOR_PACE = 10

// A career-rate projection more than this many seasons out is past the point
// of being a useful guess — it's silently assuming a player, often already
// well into his 30s, keeps playing at his recent rate for the better part of
// another decade. Rather than assert a specific (likely wrong) year that far
// out, omit the projection: the plain progress line still shows, just with no
// timeframe claimed.
const MAX_SEASONS_OUT = 8

// remaining: stat units still needed (threshold - career value).
// seasonStat/seasonGamesPlayed: this player's OWN counting stat + games this season.
// teamGamesPlayedSoFar/teamGamesRemaining: his current team's season, Final vs not-yet-played.
// remainingScheduleDates: that team's remaining games' officialDates, ascending.
// careerPerSeasonRate: his typical full-season production (see career-rate helper below).
// currentSeason: the year "this season" refers to.
export function projectMilestoneETA({
  remaining,
  seasonStat,
  seasonGamesPlayed,
  teamGamesPlayedSoFar,
  teamGamesRemaining,
  remainingScheduleDates,
  careerPerSeasonRate,
  currentSeason,
}) {
  if (!(remaining > 0)) return null
  const perGameRate =
    seasonGamesPlayed >= MIN_SEASON_GAMES_FOR_PACE && seasonStat > 0
      ? seasonStat / seasonGamesPlayed
      : 0
  const appearanceRate =
    teamGamesPlayedSoFar > 0 ? Math.min(1, seasonGamesPlayed / teamGamesPlayedSoFar) : 0

  if (perGameRate > 0 && appearanceRate > 0 && teamGamesRemaining > 0) {
    const projectedRestOfSeason = perGameRate * teamGamesRemaining * appearanceRate
    if (projectedRestOfSeason >= remaining) {
      const teamGamesNeeded = Math.ceil(remaining / perGameRate / appearanceRate)
      const idx = Math.min(teamGamesNeeded, remainingScheduleDates?.length ?? 0) - 1
      const date = idx >= 0 ? remainingScheduleDates[idx] : null
      return date ? { kind: 'date', date, season: currentSeason } : { kind: 'year', year: currentSeason }
    }
    if (careerPerSeasonRate > 0) {
      const leftover = remaining - projectedRestOfSeason
      const seasonsOut = Math.max(1, Math.ceil(leftover / careerPerSeasonRate))
      return seasonsOut <= MAX_SEASONS_OUT ? { kind: 'year', year: currentSeason + seasonsOut } : null
    }
    return null
  }

  if (careerPerSeasonRate > 0) {
    const seasonsOut = Math.max(1, Math.ceil(remaining / careerPerSeasonRate))
    return seasonsOut <= MAX_SEASONS_OUT ? { kind: 'year', year: currentSeason + seasonsOut } : null
  }
  return null
}

// A player's typical full-season production for the future-season fallback
// above — the average of his last few COMPLETED seasons (current season
// excluded; it's partial and already covered by the in-season projection).
// Recent seasons only (not full career) so an aging veteran's slowing rate
// isn't dragged up by his prime, and vice versa for a player still climbing.
export function careerPerSeasonRate(seasonTotals, statKey, currentSeason, recentSeasons = 3) {
  const completed = (seasonTotals ?? [])
    .filter((s) => Number(s.season) < currentSeason && num(s.stat?.gamesPlayed) > 0)
    .sort((a, b) => Number(b.season) - Number(a.season))
    .slice(0, recentSeasons)
  if (!completed.length) return 0
  const total = completed.reduce((t, s) => t + num(s.stat?.[statKey]), 0)
  return total / completed.length
}

// Rough historical membership counts for each milestone "club" — how many
// players/pitchers have EVER reached that threshold. Approximate (sourced
// from the well-known Hall-of-Fame-caliber clubs: 3,000 hits, 500 HR, 300
// wins, 3,000 K, …) and used only to ORDER the league-wide Milestone Watch
// page rarest-first — never displayed as a claimed exact count.
export const MILESTONE_RARITY = {
  hits: { 1000: 700, 1500: 400, 2000: 290, 2500: 150, 3000: 33, 3500: 5, 4000: 2 },
  homeRuns: { 100: 600, 150: 400, 200: 280, 250: 200, 300: 150, 350: 110, 400: 75, 450: 55, 500: 28, 550: 20, 600: 13, 700: 4, 762: 1 },
  rbi: { 1000: 250, 1500: 120, 2000: 6 },
  runs: { 1000: 250, 1500: 110, 2000: 6 },
  stolenBases: { 300: 200, 400: 90, 500: 40 },
  doubles: { 400: 110, 500: 30, 600: 8 },
  wins: { 100: 450, 150: 230, 200: 120, 250: 55, 300: 24 },
  strikeOuts: { 1000: 350, 1500: 180, 2000: 110, 2500: 55, 3000: 20, 3500: 6, 4000: 4 },
  saves: { 100: 230, 200: 110, 300: 55, 400: 25, 500: 9, 600: 1 },
}
export function milestoneRarityRank(stat, threshold) {
  return MILESTONE_RARITY[stat]?.[threshold] ?? 999
}

// The MLB career total AS OF the page's spoiler cutoff — every full season
// strictly before `currentSeason` (immutable, already fetched via
// `mlbSplits`) summed with the date-cut current-season stat (`tileStat`),
// rather than the API's own `stats=career` type (see `careerSplits` in
// loadPlayer.js), which takes no startDate/endDate and always returns the
// player's LIVE up-to-the-minute total. Using that live total for a
// countdown would leak whether a milestone was reached in a later game the
// user hasn't revealed yet when viewing an old game's player-page link
// (`asOf` set). Null when the player hasn't appeared at the MLB level this
// season (`tileSportId !== 1`) — MiLB action doesn't count toward an MLB
// milestone, and a stale prior-MLB total would misrepresent "as of now."
export function mlbCareerThroughCutoff({ mlbSplits, tileStat, tileSportId, currentSeason }, group) {
  if (tileSportId !== 1) return null
  const priorSeasons = (mlbSplits ?? []).filter((s) => Number(s.season) < currentSeason)
  return aggregateSplits([...priorSeasons, { stat: tileStat }], group)
}
