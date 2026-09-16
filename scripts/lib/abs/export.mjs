// THE ACCUMULATED ROWS, TURNED INTO public/data/abs-challenges.json — the
// export half of the pure code behind gen-abs-challenges.mjs. Its other half,
// scripts/lib/abs/rows.mjs, turns one Final game's feed into the rows this
// reads.
//
// It lives here, apart from the generator, for the reason scripts/CLAUDE.md
// gives: a generator file does its work AT IMPORT, so a helper inside one can
// never be unit-tested. Everything below is pure — rows in, summary out — with
// no clock, no network and no database, and test/abs-challenges.test.js pins
// it.
//
// THE DISCIPLINE THIS FILE EXISTS TO KEEP. The database stores FACTS: one row
// per challenge, one row per game. Every split the report page shows — per
// club, per role, per plate umpire, call type, miss distance, run value — is
// computed HERE, at export time. So a new cut of the season costs
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

import { replayBank } from './bank.mjs'
import { exposureByPlayer, exposureRates } from './exposure.mjs'

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
//
// THAT RULE IS REGULATION-ONLY, and this constant is safe because the sixth is
// as well. A club that has run out is armed again in extra innings — see
// bank.mjs, which replays it — so running out is not the end of a club's
// night the way it reads. Nothing about the sixth inning changes; everything
// about "ran out" as a phrase does, and ranOutByTeam below says what it counts
// rather than leaning on the phrase.
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

// Per club: the games it EMPTIED its bank in, and the ones it emptied early.
// Running out is the strategic cost of a failed challenge, and it is invisible
// in a success rate alone.
//
// WHAT "RAN OUT" COUNTS, now that the bank is modelled. It counts a game in
// which the club's bank reached zero at least once, and `ranOutEarly` counts
// one where that first happened by LAST_EARLY_INNING. It is deliberately NOT
// "the club finished the game with none", because in a game that goes to
// extras those are different facts: a club armed again in the tenth did run
// out in the fifth, and the cost it paid — playing four innings unable to
// argue — is exactly what the column is for.
//
// It replays the bank rather than counting to two, so a club that empties
// twice in one game counts once and the emptying inning is the FIRST one, and
// so the count stays right when the rule is used from anywhere else. Under the
// old count-to-two the two agree in regulation and diverge in extras.
//
// The replay is fed EVERY challenge, not only the lost ones. A club must hold
// one to ask at all, and an overturn hands it straight back — so `L L W` and
// `W L L` are the same failure count and different nights, and only the replay
// can tell them apart.
//
// The replay runs only as far as the last inning a challenge was lost in,
// because the ledger does not carry the game's length yet. That is enough for
// every emptying the rows can see. A club that emptied in the fifth of a game
// that went to the twelfth and never challenged again is still counted here —
// it did run out — and how long it then played re-armed is a question for the
// chances denominator, which is where the game's length belongs.
function ranOutByTeam(rows) {
  const byGameTeam = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const out = new Map() // teamId -> { ranOut, ranOutEarly }
  for (const [key, challenges] of byGameTeam) {
    // EVERY challenge, not only the lost ones: a club has to hold one to ask
    // at all, and an overturn refunds it, so `L L W` and `W L L` leave the
    // club in different places despite the same failure count.
    const { emptiedIn } = replayBank(challenges)
    if (emptiedIn.length === 0) continue
    const teamId = Number(key.split(':')[1])
    // The FIRST time it emptied. A club can empty more than once in a game
    // that goes to extras, and the game still counts once: the column is
    // "games it ran out in", not "times it ran out". An emptying the club
    // immediately undid with an overturn is not one — replayBank takes the
    // refund off before it records anything.
    const emptiedAt = emptiedIn[0]
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
export function summarizeLevel(rows, games, exposure = []) {
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
        // `role` is the role of his FIRST challenge and stays that way for
        // compatibility; `byRole` is the honest split, because a catcher who
        // also hits challenges from two places and only his own split can be
        // divided by the matching denominator (exposure.mjs).
        players.set(r.player_id, {
          ...tally(),
          name: r.player_name ?? '',
          teamId: r.team_id,
          role: r.role,
          byRole: {},
        })
      }
      const p = players.get(r.player_id)
      add(p, r)
      p.byRole[r.role] = (p.byRole[r.role] ?? 0) + 1
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

  // HOW MUCH BASEBALL EACH MAN SAW, folded across his clubs. A man traded
  // midseason is asked how often HE calls for a review, not how often he did
  // it in one uniform, so his two clubs add up (exposure.mjs).
  const seen = exposureByPlayer(exposure)

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
    // Each player's own totals, and the denominator they sit against. The two
    // rates are NOT the same kind of number and are named separately so no
    // surface can sort them into one list: a batter's is per 1,000 pitches he
    // really saw, a catcher's per 9 innings caught, because nothing in
    // statsapi counts pitches RECEIVED.
    byPlayer: [...players]
      .map(([playerId, t]) => ({
        playerId,
        name: t.name,
        teamId: t.teamId,
        role: t.role,
        ...sealed(t),
        ...exposureRates(t.byRole, seen.get(playerId)),
      }))
      .sort((a, b) => a.playerId - b.playerId),
    // EVERY MAN WHO PLAYED, not only the ones who challenged. Seven qualified
    // MLB hitters never called for a review all season, and a board built from
    // the challenge rows alone cannot see them — which is half of what the
    // question is asking. Shipped as its own list rather than folded into
    // byPlayer so the reader decides the qualifying floor.
    exposure: [...seen]
      .map(([playerId, e]) => ({ playerId, ...e }))
      .sort((a, b) => a.playerId - b.playerId),
    biggest: best ? overturnCard(best.row, best.swing) : null,
  }
}

// The whole file. Rows and games arrive as they come out of SQLite (snake_case
// columns); the split by level happens here so a caller never has to know
// which levels are on file.
export function buildExport(rows, games, { season, generatedAt, exposure = [] } = {}) {
  const levels = {}
  const names = [...new Set([...games.map((g) => g.level), ...rows.map((r) => r.level)])].sort()
  for (const level of names) {
    levels[level] = summarizeLevel(
      rows.filter((r) => r.level === level),
      games.filter((g) => g.level === level),
      exposure.filter((e) => e.level === level),
    )
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels,
  }
}
