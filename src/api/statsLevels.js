// Combined-across-levels season leaderboards — the pool producers behind the
// all-minors ('minors') and organization ('org') leader scopes in api/leaders.js.
//
// Where that file's roster fan-out gives one PoolPlayer per (player, CURRENT
// club), a player who's climbed a level mid-season is a problem: his line is
// split across levels, and the levels he's already left drop out of the pool
// entirely (he's off those clubs' rosters). So a two-level slugger never ranks
// on his COMBINED total (Andrew Fischer's 20 HR at A+ + 8 at AA should top a
// farm-system board, but neither single line does).
//
// This module instead reads the season-STATS endpoint, which is roster-
// independent — it lists everyone who accumulated a line at a level/club,
// promoted or injured or released — and SUMS each player's lines across levels
// into one combined PoolPlayer. The API already folds a same-level two-club
// player into a single split (numTeams:2), so summing by personId never double-
// counts. Rate stats (AVG/OBP/ERA/WHIP/…) are RECOMPUTED from the summed
// components, never averaged.
//
// Still spoiler-free: season aggregates only, same stance as the rest of the
// leader pages. There is no rollup shortcut — statsapi's sportId=21 ("Minors")
// carries no stats and comma-joined sportIds return nothing — so the fan-out
// (one call per level or per club, per group) and this combine are the whole job.

import { getJson } from './statsapi.js'
import { firstLast } from './person.js'
import { teamAbbr } from '../lib/teams.js'
import { fetchStaticTeams } from './teams-static.js'

// A whole level's season lines for one group ('hitting'|'pitching'): one split
// per player (playerPool=all so part-timers aren't dropped — a sub-qualified
// line at two levels can still sum to a leading total). `limit` is set past any
// single level's population so the full level returns in one page. Degrades to [].
export async function fetchLevelSeasonStats(sportId, group, season) {
  if (!sportId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/stats?stats=season&group=${group}&season=${season}&sportId=${sportId}&playerPool=all&limit=5000`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// One club's season lines for a group — same shape, scoped by teamId, so an
// org's combined board is assembled from just its affiliates (not the whole
// minors). A club's roster churns but its season stat list keeps everyone who
// logged time there, which is exactly the org-production total we want. Degrades to [].
export async function fetchTeamSeasonStats(teamId, group, season) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/stats?stats=season&group=${group}&season=${season}&teamId=${teamId}&playerPool=all&limit=5000`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// The PoolPlayer[] for a set of clubs, built from each club's roster-
// INDEPENDENT season stats rather than its current roster — so a player who's
// since been traded, released, optioned out, or promoted off one of these
// clubs still ranks, scoped to only the stats he accumulated while there (the
// teamId-scoped stats split never includes a line from any other club). One
// team's split is a no-op "sum" through sumHitting/sumPitching; combineToPool
// earns its keep here by folding in a same-team, two-stint player (released
// and re-signed) without double-counting. Used for every roster-membership
// leaderboard pool — team, league/level, and org (see leaders.js) — so a
// traded-away Rengifo or a promoted-out-of-A Fischer still shows up, credited
// only for his time on the club being viewed.
export async function loadCombinedPoolForTeams(teams, season) {
  if (!teams.length) return []
  const [hit, pit] = await Promise.all([
    Promise.allSettled(teams.map((t) => fetchTeamSeasonStats(t.id, 'hitting', season))),
    Promise.allSettled(teams.map((t) => fetchTeamSeasonStats(t.id, 'pitching', season))),
  ])
  const settledFlat = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  const pool = combineToPool(settledFlat(hit), settledFlat(pit))
  return attachDisplayTeams(pool)
}

// The team a leader row shows its logo/abbreviation for: the player's own club
// for an MLB pool, or that club's MLB parent affiliate for any MiLB club — a
// farmhand's own club mark means little to a fan skimming a leaderboard, but
// his parent org's is instantly recognizable. Resolved against the same static
// snapshot fetchTeam() reads (one cached file read, not a call per player);
// falls back to the player's own team/abbr when the org tree doesn't resolve
// (thin/stale static data, or the team truly has no parent on file).
async function attachDisplayTeams(pool) {
  const { bySportId } = await fetchStaticTeams()
  const byId = new Map(Object.values(bySportId ?? {}).flat().map((t) => [t.id, t]))
  return pool.map((p) => {
    const team = byId.get(p.teamId)
    if (!team?.parentOrgId) return { ...p, displayTeamId: p.teamId, displayTeamAbbr: p.teamAbbr }
    const parent = byId.get(team.parentOrgId)
    return {
      ...p,
      displayTeamId: team.parentOrgId,
      displayTeamAbbr: parent?.abbreviation ?? p.teamAbbr,
    }
  })
}

const num = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
// Rate = numerator / denominator, guarded so an empty denominator is 0 (not
// NaN/Infinity) — the descriptors' formatters expect a finite number.
const rate = (n, d) => (d > 0 ? n / d : 0)
// Outs → "X.Y" innings-pitched string (the shape teamLeaders' ipToOuts parses back).
const outsToIp = (outs) => `${Math.floor(outs / 3)}.${outs % 3}`

// Sum a player's hitting splits into one stat object shaped like the API's, with
// the rate fields the descriptors read (avg/obp/slg/ops/babip) recomputed from
// summed components rather than averaged. Counting fields are summed straight;
// atBats/totalBases/sacFlies ride along only to feed the rate math.
function sumHitting(splits) {
  const t = {
    atBats: 0, plateAppearances: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    rbi: 0, baseOnBalls: 0, hitByPitch: 0, strikeOuts: 0, stolenBases: 0,
    groundIntoDoublePlay: 0, sacFlies: 0, totalBases: 0,
  }
  for (const sp of splits) {
    const s = sp.stat ?? {}
    for (const k of Object.keys(t)) t[k] += num(s[k])
  }
  const obDen = t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies
  t.avg = rate(t.hits, t.atBats)
  t.slg = rate(t.totalBases, t.atBats)
  t.obp = rate(t.hits + t.baseOnBalls + t.hitByPitch, obDen)
  t.ops = t.obp + t.slg
  t.babip = rate(t.hits - t.homeRuns, t.atBats - t.strikeOuts - t.homeRuns + t.sacFlies)
  return t
}

// Sum a player's pitching splits, likewise recomputing the rate fields
// (era/whip/opp-avg/rate-per-9/K:BB/P-IP) from summed outs + components. `outs`
// is the linear innings unit; inningsPitched is re-derived from it as the
// display/parse string.
function sumPitching(splits) {
  const t = {
    gamesPitched: 0, gamesStarted: 0, saves: 0, wins: 0, losses: 0, homeRuns: 0,
    hitBatsmen: 0, baseOnBalls: 0, strikeOuts: 0, holds: 0, wildPitches: 0,
    groundIntoDoublePlay: 0, pickoffs: 0,
    outs: 0, earnedRuns: 0, hits: 0, atBats: 0, numberOfPitches: 0,
  }
  for (const sp of splits) {
    const s = sp.stat ?? {}
    for (const k of Object.keys(t)) t[k] += num(s[k])
  }
  const ip = t.outs / 3
  t.inningsPitched = outsToIp(t.outs)
  t.era = rate(t.earnedRuns * 9, ip)
  t.whip = rate(t.baseOnBalls + t.hits, ip)
  t.avg = rate(t.hits, t.atBats)
  t.pitchesPerInning = rate(t.numberOfPitches, ip)
  t.strikeoutsPer9Inn = rate(t.strikeOuts * 9, ip)
  t.walksPer9Inn = rate(t.baseOnBalls * 9, ip)
  t.strikeoutWalkRatio = rate(t.strikeOuts, t.baseOnBalls)
  return t
}

// Group hitting + pitching splits by player and combine into PoolPlayer[] (the
// shape api/teamLeaders.js ranks). Each player's identity is taken from his
// HIGHEST level reached (lowest MiLB sportId — 11 AAA tops 14 A); `levels` is
// every level his totals span, ordered low→high for the progression badge
// ("A+·AA"). A player with only one group carries a null for the other.
export function combineToPool(hittingSplits, pitchingSplits) {
  const byId = new Map()
  const add = (sp, group) => {
    const pid = sp.player?.id
    if (!pid) return
    let e = byId.get(pid)
    if (!e) {
      e = { player: sp.player, hitting: [], pitching: [], splits: [] }
      byId.set(pid, e)
    }
    e[group].push(sp)
    e.splits.push(sp)
  }
  for (const sp of hittingSplits) add(sp, 'hitting')
  for (const sp of pitchingSplits) add(sp, 'pitching')

  return [...byId.values()].map((e) => {
    const withSport = e.splits.filter((s) => s.sport?.id)
    const primary =
      withSport.reduce((best, s) => (best == null || s.sport.id < best.sport.id ? s : best), null) ??
      e.splits[0]
    const levels = [...new Set(withSport.map((s) => s.sport.id))].sort((a, b) => b - a)
    return {
      id: e.player.id,
      name: firstLast(e.player),
      teamId: primary?.team?.id ?? null,
      teamAbbr: teamAbbr(primary?.team ?? {}),
      sportId: primary?.sport?.id ?? null,
      position: primary?.position?.abbreviation ?? '',
      levels,
      hitting: e.hitting.length ? sumHitting(e.hitting) : null,
      pitching: e.pitching.length ? sumPitching(e.pitching) : null,
    }
  })
}
