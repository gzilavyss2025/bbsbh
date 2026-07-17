// Postseason Series page's data — a single series' game-by-game result,
// batting/pitching leaders scoped to just that series (e.g. "2025 NL Division
// Series"), and both teams' series rosters — a narrower cut than
// postseasonLeaders.js's since-2000 career boards.
//
// A series is only 3-7 games, so unlike the career boards (backed by the
// shared SQLite layer, docs/adr/0021) this aggregates LIVE, client-side, on
// page load — a handful of `/boxscore` fetches is cheap enough that
// precomputing it would be over-engineering. Every game in
// postseason-history.json is already Final (gen-postseason-history.mjs skips
// any season whose postseason hasn't finished), so this carries no live-game
// spoiler risk and needs no SealBox, same footing as postseasonLeaders.js.
//
// Field reads mirror scripts/gen-postseason-leaders.mjs's ingestGame (verified
// live there against gamePk 263172) — summed over just this series' games
// instead of folded into the career SQLite totals.
import { getJson } from './statsapi.js'
import { BATTING_CATEGORIES, PITCHING_CATEGORIES } from './postseasonLeaders.js'

export { BATTING_CATEGORIES, PITCHING_CATEGORIES }

// A single series' sample is far too thin for the career board's qualifier
// floors (40 AB / 15 IP) — nearly everyone who played would get filtered out.
// These scale the same "don't let a single pinch-hit AB or mop-up inning top
// a rate-stat board" idea down to what 3-7 games can actually supply.
const SERIES_MIN_AB_FOR_AVG = 6
const SERIES_MIN_OUTS_FOR_ERA = 6 // 2 innings
const SERIES_LIMIT = 5

// postseason-history.json has no top-level series index, so finding one by id
// means scanning every season's rounds. Attaches the season year + round key +
// isWorldSeries so the page's header needs no second lookup.
export function findSeriesById(history, seriesId) {
  for (const season of history?.seasons ?? []) {
    for (const round of season.rounds ?? []) {
      const series = (round.series ?? []).find((s) => s.id === seriesId)
      if (series) {
        return {
          ...series,
          year: season.year,
          roundKey: round.key,
          isWorldSeries: round.key === 'worldseries',
        }
      }
    }
  }
  return null
}

async function fetchGameBoxscore(gamePk) {
  try {
    return await getJson(`/api/v1/game/${gamePk}/boxscore`)
  } catch {
    return null
  }
}

const int = (v) => String(v)
// ".317" — three decimals, no leading zero (same convention as
// postseasonLeaders.js's career board).
const rate3 = (v) => v.toFixed(3).replace(/^(-?)0(?=\.)/, '$1')
const num2 = (v) => v.toFixed(2)

function topBy(rows, key, format) {
  return rows
    .filter((r) => r[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, SERIES_LIMIT)
    .map((r) => ({ id: r.id, name: r.name, teamId: r.teamId, display: format(r[key]), value: r[key] }))
}

function rankBatting(map) {
  const rows = [...map.entries()].map(([id, e]) => ({ id, ...e }))
  const avgRows = rows
    .filter((r) => r.atBats >= SERIES_MIN_AB_FOR_AVG)
    .map((r) => ({ id: r.id, name: r.name, teamId: r.teamId, value: Number((r.hits / r.atBats).toFixed(3)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, SERIES_LIMIT)
    .map((r) => ({ ...r, display: rate3(r.value) }))
  return {
    homeRuns: topBy(rows, 'homeRuns', int),
    rbi: topBy(rows, 'rbi', int),
    hits: topBy(rows, 'hits', int),
    avg: avgRows,
    stolenBases: topBy(rows, 'stolenBases', int),
  }
}

function rankPitching(map) {
  const rows = [...map.entries()].map(([id, e]) => ({ id, ...e }))
  const eraRows = rows
    .filter((r) => r.outs >= SERIES_MIN_OUTS_FOR_ERA)
    .map((r) => ({ id: r.id, name: r.name, teamId: r.teamId, value: Number(((r.earnedRuns * 27) / r.outs).toFixed(2)) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, SERIES_LIMIT)
    .map((r) => ({ ...r, display: num2(r.value) }))
  return {
    wins: topBy(rows, 'wins', int),
    strikeouts: topBy(rows, 'strikeOuts', int),
    saves: topBy(rows, 'saves', int),
    era: eraRows,
  }
}

// Every player dressed for a game — not just the ones who recorded a stat —
// has an entry under `team.players` (verified live against gamePk 813047:
// 26 entries per side, only ~14 with an actual batting/pitching line), so the
// SAME sweep that folds batting/pitching totals also builds each team's
// series roster for free — no second fetch. Grouped position/pitcher by the
// box score's own `position.abbreviation` (a two-way player's entry reflects
// whichever role he's listed under for that game).
function rosterEntry(p, teamId) {
  return {
    id: p.person?.id ?? null,
    name: p.person?.fullName ?? '',
    teamId,
    position: p.position?.abbreviation ?? '',
    jersey: p.jerseyNumber ?? '',
  }
}

function buildRosters(rosterByTeam) {
  const out = {}
  for (const [teamId, players] of rosterByTeam.entries()) {
    const all = [...players.values()].sort((a, b) => a.name.localeCompare(b.name))
    out[teamId] = {
      positionPlayers: all.filter((p) => p.position !== 'P'),
      pitchers: all.filter((p) => p.position === 'P'),
    }
  }
  return out
}

// Sums every player's batting/pitching lines across just this series' games
// (a handful of `/boxscore` fetches), then shapes the totals into
// TeamLeaders' `precomputed` category-map contract ({ id, name, teamId,
// display, value } per category key) — same contract postseasonLeaders.js
// uses, so the page can reuse TeamLeaders' Featured-leader/chasers layout. A
// category with no qualifying player (e.g. no saves in this series, or too
// thin a sample for the AVG/ERA floor) comes back as an empty array —
// TeamLeaders already hides those rather than rendering an empty section.
// Also returns each team's series roster (see rosterEntry/buildRosters
// above), keyed by teamId.
export async function loadSeriesStats(games) {
  const boxscores = await Promise.all((games ?? []).map((g) => fetchGameBoxscore(g.gamePk)))

  const batting = new Map()
  const pitching = new Map()
  const rosterByTeam = new Map()

  for (const box of boxscores) {
    if (!box) continue
    for (const side of ['away', 'home']) {
      const team = box.teams?.[side]
      if (!team) continue
      const teamId = team.team?.id ?? null
      for (const key of Object.keys(team.players ?? {})) {
        const p = team.players[key]
        const personId = p.person?.id
        if (!personId) continue
        const name = p.person.fullName ?? ''

        if (!rosterByTeam.has(teamId)) rosterByTeam.set(teamId, new Map())
        rosterByTeam.get(teamId).set(personId, rosterEntry(p, teamId))

        const bat = p.stats?.batting
        if (bat && (bat.atBats > 0 || bat.plateAppearances > 0)) {
          const e = batting.get(personId) ?? {
            name,
            teamId,
            atBats: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            rbi: 0,
            stolenBases: 0,
            baseOnBalls: 0,
            strikeOuts: 0,
          }
          e.name = name
          e.teamId = teamId
          e.atBats += bat.atBats ?? 0
          e.hits += bat.hits ?? 0
          e.doubles += bat.doubles ?? 0
          e.triples += bat.triples ?? 0
          e.homeRuns += bat.homeRuns ?? 0
          e.rbi += bat.rbi ?? 0
          e.stolenBases += bat.stolenBases ?? 0
          e.baseOnBalls += bat.baseOnBalls ?? 0
          e.strikeOuts += bat.strikeOuts ?? 0
          batting.set(personId, e)
        }

        const pitch = p.stats?.pitching
        if (pitch && pitch.outs > 0) {
          const e = pitching.get(personId) ?? {
            name,
            teamId,
            outs: 0,
            wins: 0,
            losses: 0,
            saves: 0,
            hits: 0,
            earnedRuns: 0,
            baseOnBalls: 0,
            strikeOuts: 0,
          }
          e.name = name
          e.teamId = teamId
          e.outs += pitch.outs ?? 0
          e.wins += pitch.wins ?? 0
          e.losses += pitch.losses ?? 0
          e.saves += pitch.saves ?? 0
          e.hits += pitch.hits ?? 0
          e.earnedRuns += pitch.earnedRuns ?? 0
          e.baseOnBalls += pitch.baseOnBalls ?? 0
          e.strikeOuts += pitch.strikeOuts ?? 0
          pitching.set(personId, e)
        }
      }
    }
  }

  return {
    batting: rankBatting(batting),
    pitching: rankPitching(pitching),
    rosters: buildRosters(rosterByTeam),
  }
}
