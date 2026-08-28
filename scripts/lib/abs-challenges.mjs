// The pure half of gen-abs-challenges.mjs, in two parts: turn ONE Final game's
// feed into challenge rows, and turn the accumulated rows plus the swept-games
// ledger into public/data/abs-challenges.json.
//
// It lives here, apart from the generator, for the reason scripts/CLAUDE.md
// gives: a generator file does its work AT IMPORT, so a helper inside one can
// never be unit-tested. Everything below is pure — a feed in, rows out; rows
// in, summary out — with no clock, no network and no database, and
// test/abs-challenges.test.js pins it.
//
// THE DISCIPLINE THIS FILE EXISTS TO KEEP. The database stores FACTS: one row
// per challenge, one row per game. Every split the report page shows — per
// club, per role, per plate umpire, call type, miss distance, run value — is
// computed here, at export time. So a new cut of the season costs
// `--export-only` and no re-sweep of two thousand game feeds, and adding one
// never needs a schema change or a backfill. Same rule gen-team-records.mjs
// follows.
//
// RANKING IS NOT DONE HERE. This file ships each club's, umpire's and player's
// own totals; sorting them against each other, and the minimum-sample floors
// that decide who appears on a board at all, live in the reader
// (src/api/around-the-game/absChallenges.js) where they are equally pure and
// where the page can change its mind about them without a regeneration. Same
// split gate.js and gen-gate.mjs already use.

import { selectChallengeState } from '../../src/api/challenges.js'
import { missEdge } from '../../src/api/umpireFavor.js'
import { pitchFavor } from '../../src/lib/runExpectancy.js'

// --- one game's rows ----------------------------------------------------------

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

// Which of the three jobs on the field the challenger was doing. A batter
// challenges a called strike against him; a catcher or a pitcher challenges a
// called ball. The matchup names the batter and the pitcher outright, so only
// the catcher has to be worked out.
//
// THE BOX SCORE'S POSITION IS NOT ENOUGH, and trusting it alone put real
// catchers in a nameless bucket: a box-score entry carries the position a man
// ENDED the game at, so a catcher who later moved to first base or to
// designated hitter reads as neither pitcher nor catcher. Iván Herrera and
// Samuel Basallo both landed there in the first backfill. The rule itself
// closes it — only three men may ask for a review — so a challenger from the
// FIELDING side who is not the pitcher is the catcher, whatever the box score
// now says he is.
//
// `other` survives as the honest bucket for what should be impossible: a
// challenge the feed attributes to nobody, or to a batting-side player who was
// not the batter. It is expected to stay near zero, and a report that hid it
// would hide the day it stops being near zero.
export function roleFor(feed, play, side, half, playerId) {
  if (playerId == null) return 'other'
  if (play?.matchup?.batter?.id === playerId) return 'batter'
  if (play?.matchup?.pitcher?.id === playerId) return 'pitcher'
  const pos = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${playerId}`]?.position?.abbreviation
  if (pos === 'C') return 'catcher'
  if (pos === 'P') return 'pitcher'
  // 'top' bats away, 'bottom' bats home — the same convention as the rest of
  // the app.
  const fielding = half === 'top' ? side === 'home' : side === 'away'
  return fielding ? 'catcher' : 'other'
}

// THE ONE TRAP IN THE FEED. On a SUCCESSFUL challenge the feed rewrites the
// pitch to the CORRECTED call — Garrett Mitchell's overturned strike in gamePk
// 823036 prints as `code: 'B'` with a four-ball count after it, and Kyle
// Hayes's overturned ball in gamePk 815863 prints as `code: 'C'`. So the
// printed call is the umpire's OWN call only when the challenge failed, and
// this is where it is flipped back. `postStrike` is what the pitch is now,
// after any overturn, which is what the run-value math must treat as the
// truth. Both are null for a pitch whose call could not be read at all.
export function umpireCallFor(code, outcome) {
  const postStrike = code === 'C' ? true : code === 'B' || code === '*B' ? false : null
  if (postStrike == null) return { postStrike: null, callType: null }
  const umpCalledStrike = outcome === 'success' ? !postStrike : postStrike
  return { postStrike, callType: umpCalledStrike ? 'strike' : 'ball' }
}

// One challenge, as a database row. `hit` is the challenged pitch event plus
// the count BEFORE it (a pitch event's own `count` is the count after), or
// null when the pitch could not be resolved — in which case call type,
// distance and run value are all null and the challenge still counts.
export function buildRow({ feed, play, challenge, hit, batSide, preBaseMask, preOuts, awayId, homeId, table }) {
  const { postStrike, callType } = umpireCallFor(hit?.ev?.details?.code, challenge.outcome)

  const c = hit?.ev?.pitchData?.coordinates
  const top = hit?.ev?.pitchData?.strikeZoneTop
  const bot = hit?.ev?.pitchData?.strikeZoneBottom
  const hasZone = c && c.pX != null && c.pZ != null && top != null && bot != null
  const missInches = hasZone ? missEdge(c.pX, c.pZ, top, bot, batSide).inches : null

  // The run expectancy an overturn moved, signed toward the batting team. Only
  // a SUCCESS moved anything — a failed challenge left the game where it was.
  // A pre-pitch count outside 0-3 balls / 0-2 strikes is corrupted feed data
  // (a fourth ball ends the plate appearance): skip favor rather than look up a
  // state that cannot exist, the same guard gen-umpire-accuracy.mjs uses.
  const pre = hit?.preCount
  let favor = null
  if (
    table && challenge.outcome === 'success' && postStrike != null && pre &&
    pre.balls <= 3 && pre.strikes <= 2
  ) {
    favor = pitchFavor(table, preBaseMask, preOuts, pre.balls, pre.strikes, postStrike)
  }

  const teamId = challenge.teamId
  return {
    team_id: teamId,
    opp_id: teamId === awayId ? homeId : awayId,
    side: challenge.side,
    player_id: challenge.playerId ?? null,
    player_name: challenge.playerName ?? '',
    role: roleFor(feed, play, challenge.side, challenge.half, challenge.playerId),
    outcome: challenge.outcome,
    inning: challenge.inning,
    half: challenge.half,
    call_type: callType,
    favor,
    miss_inches: missInches,
  }
}

// Every challenge in one Final game, enriched with the pre-pitch state the run
// value needs.
//
// The challenges themselves come from selectChallengeState (src/api/challenges.js),
// imported rather than re-scanned: that module knows an ABS review can sit at
// either the play or the pitch-event level, sometimes mirrored at both, and
// that MLB's older manager's-replay reviews carry the same `challengeTeamId`
// and must be excluded on `reviewType`. A count-only re-implementation of that
// scan has got it wrong twice in this repo already (see gen-umpire-accuracy.mjs's
// header). It is called with (feed, Infinity, 'bottom'), which its half-clamp
// reads as "the whole game" — that clamp exists for the live UI, and a Final
// game has nothing left to seal.
//
// Base and outs are carried across plays exactly as gen-run-expectancy.mjs and
// gen-umpire-accuracy.mjs do (that walk is verified against a real game's
// linescore), and the pre-pitch count is carried pitch to pitch inside a play.
export function challengeRowsForGame(feed, table) {
  const state = selectChallengeState(feed, Infinity, 'bottom')
  const all = [...state.away.outcomes, ...state.home.outcomes]
  if (all.length === 0) return []
  const byAtBat = new Map()
  for (const c of all) byAtBat.set(c.atBatIndex, c)

  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const rows = []

  let bases = [null, null, null]
  let outs = 0
  let curHalfKey = null

  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const halfKey = `${p.about?.inning}-${p.about?.halfInning}`
    if (halfKey !== curHalfKey) {
      bases = [null, null, null]
      outs = 0
      curHalfKey = halfKey
    }
    const preBaseMask = (bases[0] ? 1 : 0) | (bases[1] ? 2 : 0) | (bases[2] ? 4 : 0)
    const preOuts = Math.min(outs, 2)
    const batSide = p.matchup?.batSide?.code ?? 'R'
    const challenge = byAtBat.get(p.about?.atBatIndex)

    if (challenge) {
      let prevCount = { balls: 0, strikes: 0 }
      let hit = null
      for (const ev of p.playEvents ?? []) {
        if (!ev.isPitch) continue
        const preCount = prevCount
        prevCount = {
          balls: ev.count?.balls ?? preCount.balls,
          strikes: ev.count?.strikes ?? preCount.strikes,
        }
        if (ev.pitchNumber === challenge.pitchNumber) {
          hit = { ev, preCount }
          break
        }
      }
      rows.push(
        buildRow({ feed, play: p, challenge, hit, batSide, preBaseMask, preOuts, awayId, homeId, table }),
      )
      byAtBat.delete(p.about?.atBatIndex)
    }

    for (const r of p.runners ?? []) {
      const rid = r.details?.runner?.id
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      if (startBase) bases[startBase - 1] = null
      if (r.movement?.isOut) outs = Math.min(outs + 1, 3)
      else if (endBase) bases[endBase - 1] = rid
    }
  }

  // A challenge whose play never came round in the walk (an atBatIndex the
  // plays array does not carry) still belongs on the board — it just has no
  // pitch, so no call type, no distance and no run value.
  for (const c of byAtBat.values()) {
    rows.push(
      buildRow({
        feed, play: null, challenge: c, hit: null, batSide: 'R',
        preBaseMask: 0, preOuts: 0, awayId, homeId, table,
      }),
    )
  }

  rows.sort((a, b) => a.inning - b.inning || (a.half === 'top' ? 0 : 1) - (b.half === 'top' ? 0 : 1))
  return rows.map((r, i) => ({ ...r, seq: i }))
}

// --- the season export --------------------------------------------------------

// The four roles a challenge can come from. A batter challenges a called
// strike against him; a catcher or a pitcher challenges a called ball. `other`
// is the honest bucket for a challenger the feed named but the box score put
// at no recognisable position — it is expected to stay near zero, and a report
// that hid it would hide the day it stops being near zero.
export const ROLES = ['batter', 'catcher', 'pitcher', 'other']

// How far the challenged pitch sat from the nearest edge of the buffered
// strike zone, in inches. The bands are read from the edge outward, because
// the question the page asks is "are challenges catching howlers or coin
// flips" and an inch either side of the line is the coin flip.
export const MISS_BANDS = [
  { key: 'b0', label: 'Under 1 in', min: 0, max: 1 },
  { key: 'b1', label: '1 to 2 in', min: 1, max: 2 },
  { key: 'b2', label: '2 to 3 in', min: 2, max: 3 },
  { key: 'b3', label: '3 to 4 in', min: 3, max: 4 },
  { key: 'b4', label: '4 in and out', min: 4, max: Infinity },
]

// A club is issued two challenges and keeps one every time it wins, so it is
// out of them after its SECOND loss. Entering the seventh with none left is
// the strategic cost the page reports, which makes the sixth the last inning a
// second loss can still be called early.
export const LAST_EARLY_INNING = 6

const rate = (n, d) => (d > 0 ? n / d : null)

// One { n, success, rate } tally. Used for every categorical split below, so a
// caller reads the same three keys whichever cut it asked for.
function tally() {
  return { n: 0, success: 0 }
}
function add(t, row) {
  t.n += 1
  if (row.outcome === 'success') t.success += 1
}
function sealed(t) {
  return { n: t.n, success: t.success, rate: rate(t.success, t.n) }
}

// The run expectancy one successful challenge moved, from the point of view of
// the club that called for it. `favor` is signed toward the BATTING team
// (src/lib/runExpectancy.js's convention, kept unchanged through the database
// so the number means the same thing here as it does in the box score): the
// umpire's call had handed the batting side that much, and the overturn takes
// it back. So the challenger's own gain is -favor when the challenger was
// batting and +favor when it was in the field.
//
// It is positive on virtually every overturn — a club challenges a call that
// hurt it — which makes the season total a standing check on the sign
// convention rather than only a figure to print: if the sign were inverted,
// `runsToChallenger` would come out as the negative of `runsRecovered` instead
// of within a run of it. The handful of exceptions are the run-expectancy
// table's own per-count noise, not a challenge that hurt the club that called
// for it.
export function challengerGain(row) {
  if (row.favor == null) return null
  const challengerBatting = (row.half === 'top') === (row.side === 'away')
  return challengerBatting ? -row.favor : row.favor
}

// Per club, per game: how many challenges it lost, and the inning its second
// loss came in. Both feed the "ran out" columns on the team board — running
// out is the strategic cost of a failed challenge, and it is invisible in a
// success rate alone.
function ranOutByTeam(rows) {
  const byGameTeam = new Map()
  for (const r of rows) {
    if (r.outcome !== 'fail') continue
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const out = new Map() // teamId -> { ranOut, ranOutEarly }
  for (const [key, list] of byGameTeam) {
    if (list.length < 2) continue
    const teamId = Number(key.split(':')[1])
    // Chronological order, so the SECOND loss is the one that empties the club.
    list.sort((a, b) => a.inning - b.inning || (a.half === 'top' ? 0 : 1) - (b.half === 'top' ? 0 : 1))
    const emptiedAt = list[1].inning
    const cur = out.get(teamId) ?? { ranOut: 0, ranOutEarly: 0 }
    cur.ranOut += 1
    if (emptiedAt <= LAST_EARLY_INNING) cur.ranOutEarly += 1
    out.set(teamId, cur)
  }
  return out
}

// The one challenge the season is most likely to be remembered by: the
// overturn that moved the most run expectancy. Ties break on the later date,
// so a fresh one displaces an equal older one rather than the file freezing on
// April forever.
function biggestOverturn(rows) {
  let best = null
  for (const r of rows) {
    if (r.outcome !== 'success' || r.favor == null) continue
    const swing = Math.abs(r.favor)
    if (!best || swing > best.swing || (swing === best.swing && r.date > best.row.date)) {
      best = { swing, row: r }
    }
  }
  return best
}

function overturnCard(row, swing) {
  return {
    gamePk: row.game_pk,
    date: row.date,
    level: row.level,
    teamId: row.team_id,
    oppId: row.opp_id ?? null,
    side: row.side,
    playerId: row.player_id ?? null,
    playerName: row.player_name ?? '',
    role: row.role,
    inning: row.inning,
    half: row.half,
    umpireId: row.umpire_id ?? null,
    umpireName: row.umpire_name ?? '',
    callType: row.call_type ?? null,
    missInches: row.miss_inches ?? null,
    runs: swing,
  }
}

// Everything one level (MLB or Triple-A) shows, from that level's own rows and
// its own swept games. `games` rows carry the two club ids and the plate
// umpire, which is what lets a club that was never challenged still appear
// with a games denominator — a rate over "games in which somebody challenged"
// would flatter the clubs nobody bothers to challenge.
export function summarizeLevel(rows, games) {
  const total = rows.length
  const success = rows.filter((r) => r.outcome === 'success').length

  const byRole = new Map(ROLES.map((r) => [r, tally()]))
  const byCall = new Map([['strike', tally()], ['ball', tally()]])
  const byInning = new Map()
  const byBand = new Map(MISS_BANDS.map((b) => [b.key, tally()]))
  const teamCounts = new Map()
  const umpCounts = new Map()
  const players = new Map()

  let runsRecovered = 0
  let runsToChallenger = 0
  let runsToBatting = 0
  let scoredOverturns = 0

  for (const r of rows) {
    add(byRole.get(r.role) ?? byRole.get('other'), r)
    if (byCall.has(r.call_type)) add(byCall.get(r.call_type), r)

    const inningKey = r.inning
    if (!byInning.has(inningKey)) byInning.set(inningKey, tally())
    add(byInning.get(inningKey), r)

    if (r.miss_inches != null) {
      const band = MISS_BANDS.find((b) => r.miss_inches >= b.min && r.miss_inches < b.max)
      if (band) add(byBand.get(band.key), r)
    }

    if (!teamCounts.has(r.team_id)) teamCounts.set(r.team_id, tally())
    add(teamCounts.get(r.team_id), r)

    if (r.umpire_id != null) {
      if (!umpCounts.has(r.umpire_id)) umpCounts.set(r.umpire_id, { ...tally(), name: r.umpire_name ?? '' })
      add(umpCounts.get(r.umpire_id), r)
    }

    if (r.player_id != null) {
      if (!players.has(r.player_id)) {
        players.set(r.player_id, { ...tally(), name: r.player_name ?? '', teamId: r.team_id, role: r.role })
      }
      add(players.get(r.player_id), r)
    }

    if (r.outcome === 'success' && r.favor != null) {
      const gain = challengerGain(r)
      runsRecovered += Math.abs(r.favor)
      runsToChallenger += gain
      runsToBatting += -r.favor
      scoredOverturns += 1
    }
  }

  // Games played, per club and per umpire — the denominators. Read off the
  // ledger, not off the challenge rows, for the reason in this function's
  // header.
  const teamGames = new Map()
  const umpGames = new Map()
  for (const g of games) {
    for (const id of [g.away_team_id, g.home_team_id]) {
      if (id != null) teamGames.set(id, (teamGames.get(id) ?? 0) + 1)
    }
    if (g.umpire_id != null) umpGames.set(g.umpire_id, (umpGames.get(g.umpire_id) ?? 0) + 1)
  }

  const ranOut = ranOutByTeam(rows)
  const dates = games.map((g) => g.date).filter(Boolean).sort()
  const best = biggestOverturn(rows)

  return {
    games: games.length,
    gamesWithChallenge: games.filter((g) => (g.challenges ?? 0) > 0).length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    total,
    success,
    successRate: rate(success, total),
    perGame: rate(total, games.length),
    // The headline. Every overturn moved run expectancy off the umpire's call
    // and onto the correct one; this is that movement added up, which is what
    // the challenge system has been worth this season in runs.
    runsRecovered,
    runsToChallenger,
    runsToBatting,
    scoredOverturns,
    byRole: ROLES.map((role) => ({ role, ...sealed(byRole.get(role)) })),
    byCall: [...byCall].map(([callType, t]) => ({ callType, ...sealed(t) })),
    byInning: [...byInning]
      .sort((a, b) => a[0] - b[0])
      .map(([inning, t]) => ({ inning, ...sealed(t) })),
    byMiss: MISS_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      ...sealed(byBand.get(b.key)),
    })),
    byTeam: [...teamGames]
      .map(([teamId, gp]) => {
        const t = teamCounts.get(teamId) ?? tally()
        const ro = ranOut.get(teamId) ?? { ranOut: 0, ranOutEarly: 0 }
        return {
          teamId,
          games: gp,
          ...sealed(t),
          perGame: rate(t.n, gp),
          ranOut: ro.ranOut,
          ranOutEarly: ro.ranOutEarly,
        }
      })
      .sort((a, b) => a.teamId - b.teamId),
    byUmpire: [...umpCounts]
      .map(([umpireId, t]) => ({
        umpireId,
        name: t.name,
        games: umpGames.get(umpireId) ?? 0,
        ...sealed(t),
        perGame: rate(t.n, umpGames.get(umpireId) ?? 0),
      }))
      .sort((a, b) => a.umpireId - b.umpireId),
    byPlayer: [...players]
      .map(([playerId, t]) => ({
        playerId,
        name: t.name,
        teamId: t.teamId,
        role: t.role,
        ...sealed(t),
      }))
      .sort((a, b) => a.playerId - b.playerId),
    biggest: best ? overturnCard(best.row, best.swing) : null,
  }
}

// The whole file. Rows and games arrive as they come out of SQLite (snake_case
// columns); the split by level happens here so a caller never has to know
// which levels are on file.
export function buildExport(rows, games, { season, generatedAt } = {}) {
  const levels = {}
  const names = [...new Set([...games.map((g) => g.level), ...rows.map((r) => r.level)])].sort()
  for (const level of names) {
    levels[level] = summarizeLevel(
      rows.filter((r) => r.level === level),
      games.filter((g) => g.level === level),
    )
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels,
  }
}
