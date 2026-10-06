// ONE FINAL GAME'S FEED, TURNED INTO CHALLENGE ROWS — the sweep half of the
// pure code behind gen-abs-challenges.mjs. Its other half, scripts/lib/abs/
// export.mjs, turns the accumulated rows into the season JSON.
//
// It lives here, apart from the generator, for the reason scripts/CLAUDE.md
// gives: a generator file does its work AT IMPORT, so a helper inside one can
// never be unit-tested. Everything below is pure — a feed in, rows out — with
// no clock, no network and no database, and test/abs-challenges.test.js pins
// it.
//
// WHAT A ROW HOLDS IS A FACT, never a split. One row per challenge, and every
// cut the report page shows — per club, per role, per plate umpire, call type,
// miss distance, run value — is computed later, at export time. So a new cut of
// the season costs `--export-only` and no re-sweep of two thousand game feeds,
// and adding one never needs a schema change or a backfill. Same rule
// gen-team-records.mjs follows. Anything this file is tempted to pre-aggregate
// belongs in export.mjs instead.

import { selectChallengeState } from '../../../src/api/challenges.js'
import { missEdge } from '../../../src/api/umpireFavor.js'
import { pitchFavor } from '../../../src/lib/runExpectancy.js'
import { scopeOfGameType } from '../records/postseason.mjs'

// --- one game's rows ----------------------------------------------------------

// WHICH GAMES GO ON THE LEDGER, and the one field that decides it.
//
// `abs_ingested_games` is not only the idempotency guard — it is the
// DENOMINATOR every per-game figure on /abs-challenges divides by, so a row
// that never should have been there does not sit harmlessly, it moves a
// published number.
//
// The rule used to read `abstractGameState === 'Final'` and then exclude
// `detailedState === 'Postponed'`, and that let two kinds of non-game in. A
// game called off for weather comes back with an abstract state of FINAL and a
// detailed state of `Cancelled: Rain` — no innings, no plays, no result — and
// 23 of them were on the Triple-A ledger. So did one game that started, was
// suspended after two innings, and was then cancelled outright (gamePk
// 815811): its schedule row ends up Cancelled like the rest, while its feed
// still reads `Suspended: Rain`.
//
// MATCHING THE DETAILED STRING IS THE WRONG FIX, because the string carries
// the reason — `Cancelled: Rain`, `Postponed`, `Completed Early: Rain` — so
// every new reason is a new string nobody knew to exclude. `codedGameState` is
// one character and carries no reason, and across the whole 2026 MLB and
// Triple-A schedule it takes exactly five values:
//
//   F  Final           4,407   played, and played out
//   F  Completed Early    32   PLAYED, shortened by weather — 109 real
//                             challenges, and they belong on the board
//   C  Cancelled          24   never played: zero innings, zero plays
//   D  Postponed         105   never played on that date
//   S  Scheduled         249   not played yet
//
// So `F` is the whole rule. It admits both states of a game that happened and
// excludes both states of one that did not, and a shortened game — a real
// game, with real challenges — keeps its place. Anything MLB adds later that
// is not a played game will not be coded F.
export const PLAYED_CODE = 'F'
export function isPlayedGame(status) {
  return status?.codedGameState === PLAYED_CODE
}

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
// The closed set roleFor can return, in the order every board reads them. It
// lives beside the function that produces it rather than beside the boards
// that consume it, so a fifth role could never be emitted here and go
// unlisted there.
export const ROLES = ['batter', 'catcher', 'pitcher', 'other']

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
  // A LIST per at-bat, never one challenge: a plate appearance can carry two or
  // more (#963, #1277) — the same club twice, or both clubs. A map that keeps
  // one per key dropped every challenge but the last, and the ledger every
  // figure on /abs-challenges reads came up short of the live bank.
  const byAtBat = new Map()
  for (const c of all) {
    const list = byAtBat.get(c.atBatIndex)
    if (list) list.push(c)
    else byAtBat.set(c.atBatIndex, [c])
  }
  // `all` is the away club's challenges, then the home club's, which is not
  // time order, and the bank replay reads the order rows are written in. Time
  // order inside an at-bat is pitch order, and a play-level review (resolved to
  // the last pitch) goes after a pitch-level one on the same pitch — the order
  // challengesForPlay itself returns them in.
  const inTimeOrder = (a, b) =>
    (a.pitchNumber ?? Infinity) - (b.pitchNumber ?? Infinity) ||
    (a.isHeuristic ? 1 : 0) - (b.isHeuristic ? 1 : 0)
  for (const list of byAtBat.values()) list.sort(inTimeOrder)

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
    const challenges = byAtBat.get(p.about?.atBatIndex)

    if (challenges) {
      // Each challenge finds its own pitch. The count before it is carried
      // pitch to pitch, so this reads the play's events once per challenge.
      for (const challenge of challenges) {
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
      }
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
  for (const c of [...byAtBat.values()].flat()) {
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


// THE REBUILD WIPES ONE SEASON. Every season stays on file (ADR-0086, #1200),
// so `--rebuild` clears the challenge rows and the ledger of the season it is
// about to sweep again, and leaves every other season as it was.
export function clearSeasonRows(db, season) {
  db.prepare('DELETE FROM abs_challenges WHERE season = ?').run(season)
  db.prepare('DELETE FROM abs_ingested_games WHERE season = ?').run(season)
}

// --- the postseason beside the regular season (#1514, ADR-0094's shape) -------

// A game's scope, from its schedule row. The sweep asks for R plus these.
export { scopeOfGameType }

// The scope lives on the GAME. A challenge row takes it through game_pk; a game
// row with no scope is regular season (an old row, or a test fixture). 'all' is
// both parts, never one counted over the other.
export function inScope(rows, games, scope) {
  if (scope === 'all') return { rows, games }
  const kept = games.filter((g) => (g.scope ?? 'R') === scope)
  const pks = new Set(kept.map((g) => g.game_pk))
  return { rows: rows.filter((r) => pks.has(r.game_pk)), games: kept }
}

// The sweep's two writes, here so a test can run them (the generator does its
// work at import). INSERT OR REPLACE on the keys, so a second sweep of one game
// writes the same rows again and adds nothing.
export function ingestGame(db, t, rows, shape) {
  const insertRow = db.prepare(
    `INSERT OR REPLACE INTO abs_challenges
       (game_pk, seq, season, date, level, team_id, opp_id, side, player_id, player_name,
        role, outcome, inning, half, umpire_id, umpire_name, call_type, favor, miss_inches)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const r of rows) {
    insertRow.run(
      t.gamePk, r.seq, t.season, t.date, t.level, r.team_id, r.opp_id,
      r.side, r.player_id, r.player_name, r.role, r.outcome, r.inning, r.half,
      t.umpId, t.umpName, r.call_type, r.favor, r.miss_inches,
    )
  }
  db.prepare(
    `INSERT OR REPLACE INTO abs_ingested_games
       (game_pk, date, season, level, away_team_id, home_team_id, umpire_id, challenges,
        final_inning, bottom_played, scheduled_innings, scope)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    t.gamePk, t.date, t.season, t.level, t.awayTeamId, t.homeTeamId, t.umpId, rows.length,
    shape.finalInning, shape.bottomPlayed, shape.scheduledInnings, t.scope,
  )
}

// --recheck's write on a game already on file: its scope always, its length
// when the schedule row carries one. Never touches the challenge rows.
export function restampGame(db, gamePk, { scope, shape }) {
  db.prepare('UPDATE abs_ingested_games SET scope = ? WHERE game_pk = ?').run(scope, gamePk)
  if (shape?.finalInning == null) return false
  db.prepare(
    'UPDATE abs_ingested_games SET final_inning = ?, bottom_played = ?, scheduled_innings = ? WHERE game_pk = ?',
  ).run(shape.finalInning, shape.bottomPlayed, shape.scheduledInnings, gamePk)
  return true
}
