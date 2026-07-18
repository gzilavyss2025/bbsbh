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
import { BATTING_CATEGORIES, int, rate3 } from './postseasonLeaders.js'
import { startingPositionAbbr } from './select.js'

export { BATTING_CATEGORIES }

// The career board's pitching categories end in a rate stat (ERA), but a
// 3-7 game series is too thin a sample for a rate to read as meaningful — so
// this page swaps it for the two counting stats a rate is built from, each
// its own most-to-least ranked row like every other category here (see
// rankPitching below): innings pitched (the workhorse) and earned runs
// (who got hit hardest — most series would otherwise just surface a string
// of mop-up arms who allowed zero runs in an inning or two).
export const SERIES_PITCHING_CATEGORIES = [
  { key: 'wins', label: 'Wins', short: 'W' },
  { key: 'strikeouts', label: 'Strikeouts', short: 'SO' },
  { key: 'saves', label: 'Saves', short: 'SV' },
  { key: 'inningsPitched', label: 'Innings pitched', short: 'IP' },
  { key: 'earnedRuns', label: 'Earned runs', short: 'ER' },
]

// A single series' sample is far too thin for the career board's qualifier
// floor (40 AB) — nearly everyone who played would get filtered out. This
// scales the same "don't let a single pinch-hit AB top a rate-stat board"
// idea down to what 3-7 games can actually supply.
const SERIES_MIN_AB_FOR_AVG = 6
const SERIES_LIMIT = 5
// For the categories only a handful of players ever touch at all (HR, W, SV,
// ER — most series see just a few homers, decisions, or save chances total),
// truncating to SERIES_LIMIT can drop someone for no real reason when the
// whole qualifying pool is barely bigger than the cap itself. If the pool is
// at most this many, show everyone instead of cutting it to SERIES_LIMIT.
const SERIES_UNCAPPED_FLOOR = 8

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

// "6.2" — box score innings-pitched notation (whole innings + outs left over).
const ipFormat = (outs) => `${Math.floor(outs / 3)}.${outs % 3}`

// `uncapped: true` (HR, W, SV, ER — see SERIES_UNCAPPED_FLOOR) lifts the
// SERIES_LIMIT cut when the whole qualifying pool is barely bigger than it.
function topBy(rows, key, format, { uncapped = false } = {}) {
  const qualifying = rows.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key])
  const limit = uncapped && qualifying.length <= SERIES_UNCAPPED_FLOOR ? qualifying.length : SERIES_LIMIT
  return qualifying
    .slice(0, limit)
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
    homeRuns: topBy(rows, 'homeRuns', int, { uncapped: true }),
    rbi: topBy(rows, 'rbi', int),
    hits: topBy(rows, 'hits', int),
    avg: avgRows,
    stolenBases: topBy(rows, 'stolenBases', int),
  }
}

function rankPitching(map) {
  const rows = [...map.entries()].map(([id, e]) => ({ id, ...e }))
  // Most-to-least, same counting-stat convention as wins/strikeouts/saves —
  // a series is too thin a sample for "fewest earned runs" to single out
  // anyone but a string of mop-up guys who each faced a batter or two, so
  // this instead surfaces who actually got hit hard.
  return {
    wins: topBy(rows, 'wins', int, { uncapped: true }),
    strikeouts: topBy(rows, 'strikeOuts', int),
    saves: topBy(rows, 'saves', int, { uncapped: true }),
    inningsPitched: topBy(rows, 'outs', ipFormat),
    earnedRuns: topBy(rows, 'earnedRuns', int, { uncapped: true }),
  }
}

// Every player dressed for a game — not just the ones who recorded a stat —
// has an entry under `team.players` (verified live against gamePk 813047:
// 26 entries per side, only ~14 with an actual batting/pitching line), so the
// SAME sweep that folds batting/pitching totals also builds each team's
// series roster for free — no second fetch. Position uses startingPositionAbbr
// (select.js, see ADR-0005) — a player's PRIMARY position for that game, not
// his current/final box.position, which drifts to whatever spot he ended the
// game at; a position player who mops up an inning of relief would otherwise
// get filed as a pitcher for the whole series roster.
function rosterEntry(p, teamId) {
  return {
    id: p.person?.id ?? null,
    name: p.person?.fullName ?? '',
    teamId,
    position: startingPositionAbbr(p),
    jersey: p.jerseyNumber ?? '',
  }
}

// Scorebook defensive order (2 through 9), DH tacked on at the end since it
// carries no defensive number; anything else a box score might list a
// substitute under (PH, PR, IF, OF, …) falls back to last, alphabetical
// among itself.
const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
function positionRank(position) {
  const idx = POSITION_ORDER.indexOf(position)
  return idx === -1 ? POSITION_ORDER.length : idx
}

function buildRosters(rosterByTeam) {
  const out = {}
  for (const [teamId, players] of rosterByTeam.entries()) {
    const all = [...players.values()]
    out[teamId] = {
      positionPlayers: all
        .filter((p) => p.position !== 'P')
        .sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.name.localeCompare(b.name)),
      pitchers: all.filter((p) => p.position === 'P').sort((a, b) => a.name.localeCompare(b.name)),
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
// thin a sample for the AVG floor) comes back as an empty array —
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
