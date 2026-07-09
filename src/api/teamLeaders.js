// Team Leaders — per-player season leaderboards for a team profile page. For a
// given statistical category it ranks the club's players and returns the top N,
// so the page can feature the leader (headshot card) with the chasers beneath.
//
// NOT spoiler-bearing: these are SEASON aggregates (near-zero spoiler risk per
// docs/data-enrichment.md §2), and the team page already shows standings/WAR
// openly — so unlike the win-probability Top Performers card, nothing here needs
// a SealBox.
//
// The module is deliberately POOL-AGNOSTIC: every ranking/formatting function
// reads only a normalized `PoolPlayer` array and a category descriptor, never
// how that pool was assembled. Today the pool is one team's roster
// (`normalizeRosterToPool`); the same `computeLeaders` + descriptors are meant to
// later rank a whole league/level by swapping in a different pool producer (see
// the Phase 3 note at the bottom).
//
// PoolPlayer shape (the swappable boundary):
//   { id, name, teamId, teamAbbr, position, sportId,
//     hitting: <season hitting stat obj | null>,
//     pitching: <season pitching stat obj | null> }
//
// `sportId` (the club's level: 1 MLB, 11 AAA, …) rides along so a multi-level
// pool — an org's whole farm system — can badge each leader with his level;
// null / ignored for a single-level pool.

import { firstLast } from './person.js'

const DASH = '—'

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// Innings pitched ("104.1" = 104 ⅓) → outs, so playing-time comparisons and the
// IP leaderboard sort linearly (raw "104.1" < "104.2" happens to work, but
// "104.2" + one out is "105.0", not "104.3", so compare in outs to be safe).
function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}
function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// ---------------------------------------------------------------------------
// Formatters (baseball display conventions)
// ---------------------------------------------------------------------------
// ".302" — three decimals, no leading zero.
function rate3(v) {
  if (!Number.isFinite(v)) return DASH
  return v.toFixed(3).replace(/^(-?)0(?=\.)/, '$1')
}
// "3.45" — two decimals (ERA, WHIP, rate-per-9, K/BB, P/IP).
function num2(v) {
  if (!Number.isFinite(v)) return DASH
  return v.toFixed(2)
}
// "24.1%" — a ratio rendered as a percentage (SO%, BB%).
function pct1(v) {
  if (!Number.isFinite(v)) return DASH
  return `${(v * 100).toFixed(1)}%`
}
// Whole counting stat.
function int(v) {
  if (!Number.isFinite(v)) return DASH
  return String(v)
}

// ---------------------------------------------------------------------------
// Category descriptors
// ---------------------------------------------------------------------------
// { key, label, short, group, value(stat)→number|null, format(v)→string,
//   sortDir: 'asc'|'desc', qualified: bool }
//
// - `value` is the ONLY place derived stats live (XBH, SO%, BB%, IP-as-outs).
// - `sortDir` encodes "best-is-leader": ascending where lowest is best
//   (ERA/WHIP/AVG-against; batter SO/GIDP; pitcher L/HR/HB/BB/WP/BB9/P-IP), else
//   descending. Every list therefore reads as a "good" list.
// - `qualified: true` opts the category into the roster-relative playing-time
//   filter in computeLeaders (rate stats + "fewest-of-a-bad-thing" counts, where
//   a low-volume player would otherwise top the list). Pure "most-of-a-good-
//   thing" counting stats stay unqualified so a September call-up can still lead
//   the team in, say, HR if he genuinely does.

export const HITTING_CATEGORIES = [
  { key: 'avg', label: 'Batting average', short: 'AVG', group: 'hitting', value: (s) => num(s.avg), format: rate3, sortDir: 'desc', qualified: true },
  { key: 'obp', label: 'On-base %', short: 'OBP', group: 'hitting', value: (s) => num(s.obp), format: rate3, sortDir: 'desc', qualified: true },
  { key: 'slg', label: 'Slugging %', short: 'SLG', group: 'hitting', value: (s) => num(s.slg), format: rate3, sortDir: 'desc', qualified: true },
  { key: 'ops', label: 'OPS', short: 'OPS', group: 'hitting', value: (s) => num(s.ops), format: rate3, sortDir: 'desc', qualified: true },
  { key: 'hits', label: 'Hits', short: 'H', group: 'hitting', value: (s) => num(s.hits), format: int, sortDir: 'desc', qualified: false },
  { key: 'doubles', label: 'Doubles', short: '2B', group: 'hitting', value: (s) => num(s.doubles), format: int, sortDir: 'desc', qualified: false },
  { key: 'triples', label: 'Triples', short: '3B', group: 'hitting', value: (s) => num(s.triples), format: int, sortDir: 'desc', qualified: false },
  { key: 'xbh', label: 'Extra-base hits', short: 'XBH', group: 'hitting', value: (s) => num(s.doubles) + num(s.triples) + num(s.homeRuns), format: int, sortDir: 'desc', qualified: false },
  { key: 'hr', label: 'Home runs', short: 'HR', group: 'hitting', value: (s) => num(s.homeRuns), format: int, sortDir: 'desc', qualified: false },
  { key: 'rbi', label: 'RBI', short: 'RBI', group: 'hitting', value: (s) => num(s.rbi), format: int, sortDir: 'desc', qualified: false },
  { key: 'so_b', label: 'Fewest strikeouts', short: 'SO', group: 'hitting', value: (s) => num(s.strikeOuts), format: int, sortDir: 'asc', qualified: true },
  { key: 'bb_b', label: 'Walks', short: 'BB', group: 'hitting', value: (s) => num(s.baseOnBalls), format: int, sortDir: 'desc', qualified: false },
  { key: 'sopct', label: 'Strikeout rate', short: 'SO%', group: 'hitting', value: (s) => (num(s.plateAppearances) ? num(s.strikeOuts) / num(s.plateAppearances) : null), format: pct1, sortDir: 'asc', qualified: true },
  { key: 'bbpct', label: 'Walk rate', short: 'BB%', group: 'hitting', value: (s) => (num(s.plateAppearances) ? num(s.baseOnBalls) / num(s.plateAppearances) : null), format: pct1, sortDir: 'desc', qualified: true },
  { key: 'sb', label: 'Stolen bases', short: 'SB', group: 'hitting', value: (s) => num(s.stolenBases), format: int, sortDir: 'desc', qualified: false },
  { key: 'babip', label: 'BABIP', short: 'BABIP', group: 'hitting', value: (s) => num(s.babip), format: rate3, sortDir: 'desc', qualified: true },
  { key: 'hbp', label: 'Hit by pitch', short: 'HBP', group: 'hitting', value: (s) => num(s.hitByPitch), format: int, sortDir: 'desc', qualified: false },
  { key: 'gidp', label: 'Fewest GIDP', short: 'GIDP', group: 'hitting', value: (s) => num(s.groundIntoDoublePlay), format: int, sortDir: 'asc', qualified: true },
]

export const PITCHING_CATEGORIES = [
  { key: 'g', label: 'Games', short: 'G', group: 'pitching', value: (s) => num(s.gamesPitched), format: int, sortDir: 'desc', qualified: false },
  { key: 'gs', label: 'Games started', short: 'GS', group: 'pitching', value: (s) => num(s.gamesStarted), format: int, sortDir: 'desc', qualified: false },
  { key: 'ip', label: 'Innings pitched', short: 'IP', group: 'pitching', value: (s) => ipToOuts(s.inningsPitched), format: outsToIp, sortDir: 'desc', qualified: false },
  { key: 'sv', label: 'Saves', short: 'SV', group: 'pitching', value: (s) => num(s.saves), format: int, sortDir: 'desc', qualified: false },
  { key: 'w', label: 'Wins', short: 'W', group: 'pitching', value: (s) => num(s.wins), format: int, sortDir: 'desc', qualified: false },
  { key: 'l', label: 'Fewest losses', short: 'L', group: 'pitching', value: (s) => num(s.losses), format: int, sortDir: 'asc', qualified: true },
  { key: 'era', label: 'ERA', short: 'ERA', group: 'pitching', value: (s) => num(s.era), format: num2, sortDir: 'asc', qualified: true },
  { key: 'hr_p', label: 'Fewest HR allowed', short: 'HR', group: 'pitching', value: (s) => num(s.homeRuns), format: int, sortDir: 'asc', qualified: true },
  { key: 'hb', label: 'Fewest hit batters', short: 'HB', group: 'pitching', value: (s) => num(s.hitBatsmen), format: int, sortDir: 'asc', qualified: true },
  { key: 'bb_p', label: 'Fewest walks', short: 'BB', group: 'pitching', value: (s) => num(s.baseOnBalls), format: int, sortDir: 'asc', qualified: true },
  { key: 'so_p', label: 'Strikeouts', short: 'SO', group: 'pitching', value: (s) => num(s.strikeOuts), format: int, sortDir: 'desc', qualified: false },
  { key: 'whip', label: 'WHIP', short: 'WHIP', group: 'pitching', value: (s) => num(s.whip), format: num2, sortDir: 'asc', qualified: true },
  { key: 'avg_p', label: 'Opponent AVG', short: 'AVG', group: 'pitching', value: (s) => num(s.avg), format: rate3, sortDir: 'asc', qualified: true },
  { key: 'pip', label: 'Pitches per inning', short: 'P/IP', group: 'pitching', value: (s) => num(s.pitchesPerInning), format: num2, sortDir: 'asc', qualified: true },
  // QS (quality starts) — TODO: not in the season aggregate; needs a per-game
  // gameLog derivation, which docs/data-enrichment.md flags as spoiler-risky.
  { key: 'hld', label: 'Holds', short: 'HLD', group: 'pitching', value: (s) => num(s.holds), format: int, sortDir: 'desc', qualified: false },
  { key: 'wp', label: 'Fewest wild pitches', short: 'WP', group: 'pitching', value: (s) => num(s.wildPitches), format: int, sortDir: 'asc', qualified: true },
  { key: 'gdp', label: 'Double plays induced', short: 'GDP', group: 'pitching', value: (s) => num(s.groundIntoDoublePlay), format: int, sortDir: 'desc', qualified: false },
  { key: 'so9', label: 'Strikeouts per 9', short: 'SO/9', group: 'pitching', value: (s) => num(s.strikeoutsPer9Inn), format: num2, sortDir: 'desc', qualified: true },
  { key: 'bb9', label: 'Walks per 9', short: 'BB/9', group: 'pitching', value: (s) => num(s.walksPer9Inn), format: num2, sortDir: 'asc', qualified: true },
  { key: 'kbb', label: 'Strikeout-to-walk', short: 'K/BB', group: 'pitching', value: (s) => num(s.strikeoutWalkRatio), format: num2, sortDir: 'desc', qualified: true },
  { key: 'pk', label: 'Pickoffs', short: 'PK', group: 'pitching', value: (s) => num(s.pickoffs), format: int, sortDir: 'desc', qualified: false },
]

// Phase 2 full list (a dedicated /team/{id}/leaders page).
export const ALL_CATEGORIES = [...HITTING_CATEGORIES, ...PITCHING_CATEGORIES]

// Phase 1 starter set on the team page itself — a sensible cross-section to
// validate the layout + data wiring end to end.
const FEATURED_KEYS = ['avg', 'hr', 'rbi', 'era', 'so_p', 'sv']
export const FEATURED_CATEGORIES = FEATURED_KEYS.map((k) =>
  ALL_CATEGORIES.find((c) => c.key === k),
)

// ---------------------------------------------------------------------------
// Pool producers + ranking
// ---------------------------------------------------------------------------

// The season stat split for a group, selected BY GROUP NAME (fetchTeamRoster
// hydrates both hitting and pitching, so index-0 is not reliably one group).
function splitFor(person, group) {
  return (
    (person?.stats ?? []).find((s) => s.group?.displayName === group)?.splits?.[0]
      ?.stat ?? null
  )
}

// One team's active roster → PoolPlayer[]. `team` stamps the club identity onto
// every player (all the same here; the field earns its keep once the pool spans
// multiple teams — see Phase 3).
export function normalizeRosterToPool(roster, team) {
  return (roster ?? [])
    .filter((r) => r.person?.id)
    .map((r) => ({
      id: r.person.id,
      name: firstLast(r.person),
      teamId: team?.id ?? null,
      teamAbbr: team?.abbreviation ?? '',
      sportId: team?.sport?.id ?? null,
      position: r.position?.abbreviation ?? '',
      hitting: splitFor(r.person, 'hitting'),
      pitching: splitFor(r.person, 'pitching'),
    }))
}

// Playing time in a group's natural unit — PA for hitters, outs for pitchers.
// Used for both the roster-relative qualifier and the tie-break.
function playingTime(stat, group) {
  return group === 'hitting'
    ? num(stat.plateAppearances)
    : ipToOuts(stat.inningsPitched)
}

// Qualification for `qualified` (rate + "fewest") categories — two modes, since
// what makes a fair playing-time bar differs by pool size:
//
// - 'roster' (default): keep the top ~60% of the pool by playing time FOR THAT
//   GROUP. Right for a single 26-man roster — a 2-for-3 call-up can't top the
//   AVG list, while a genuine counting-stat leader is never filtered out.
//
// - 'leader-relative': keep everyone with at least 60% of the pool LEADER's
//   playing time for that group. On a ~1000-player league/level pool the
//   roster-relative "top 60%" still reaches down to part-timers (600 players),
//   so a 40-PA hot streak could top AVG; a leader-relative floor tracks a real
//   qualification bar and self-scales through the season (early-season the
//   leader's PA is small, so the floor is too).
//
// Either way, unqualified counting stats (HR, SO, …) skip this entirely.
const QUAL_FRACTION = 0.6
function eligiblePlayers(pool, category, qualifier = 'roster') {
  const group = category.group
  const withSplit = pool.filter((p) => p[group])
  if (!category.qualified || withSplit.length === 0) return withSplit
  if (qualifier === 'leader-relative') {
    const maxTime = Math.max(...withSplit.map((p) => playingTime(p[group], group)))
    const floor = QUAL_FRACTION * maxTime
    return withSplit.filter((p) => playingTime(p[group], group) >= floor)
  }
  const ranked = [...withSplit].sort(
    (a, b) => playingTime(b[group], group) - playingTime(a[group], group),
  )
  const keep = Math.max(1, Math.ceil(QUAL_FRACTION * ranked.length))
  return ranked.slice(0, keep)
}

// Top-N leaders for one category. Pure: reads only the pool + descriptor.
// Returns [{ rank, id, name, teamId, teamAbbr, sportId, position, value, display }].
// `qualifier` selects the playing-time bar for rate categories (see
// eligiblePlayers) — 'roster' for a single team, 'leader-relative' for a
// league/level/org pool.
export function computeLeaders(pool, category, { limit = 5, qualifier = 'roster' } = {}) {
  const group = category.group
  return eligiblePlayers(pool, category, qualifier)
    .map((p) => ({ p, v: category.value(p[group]), tb: playingTime(p[group], group) }))
    .filter((r) => r.v != null && Number.isFinite(r.v))
    // For "most-of-a-good-thing" categories, a 0 means the player never did
    // it at all — never worth padding the list out with (thin categories
    // like Pickoffs would otherwise trail off into a wall of zeroes). A
    // "fewest" (asc) category keeps its zeroes: 0 there is the best value.
    .filter((r) => category.sortDir !== 'desc' || r.v !== 0)
    .sort((a, b) => {
      const cmp = category.sortDir === 'asc' ? a.v - b.v : b.v - a.v
      if (cmp !== 0) return cmp
      if (b.tb !== a.tb) return b.tb - a.tb // tie-break: more playing time
      return a.p.name.localeCompare(b.p.name) // then A→Z
    })
    .slice(0, limit)
    .map((r, i) => ({
      rank: i + 1,
      id: r.p.id,
      name: r.p.name,
      teamId: r.p.teamId,
      teamAbbr: r.p.teamAbbr,
      sportId: r.p.sportId ?? null,
      // The levels a combined (org / all-minors) total spans, for the multi-
      // level badge; absent on single-level pools (badge falls back to sportId).
      levels: r.p.levels ?? null,
      position: r.p.position,
      value: r.v,
      display: category.format(r.v),
    }))
}

// Phase 3 (built — see api/leaders.js): league/level/org pool producers emit the
// SAME PoolPlayer[] shape, so computeLeaders + the descriptors + the render
// components stay untouched — a scope selector swaps only the producer feeding
// the pool. Rather than the batch /people endpoint sketched here, leaders.js
// reuses fetchTeamRoster (already hydrated + cached) fanned out over a scope's
// clubs, resolved from the static teams file (no new endpoint), and passes
// `qualifier: 'leader-relative'` for the larger pools.
