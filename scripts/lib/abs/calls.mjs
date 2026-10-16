// CHALLENGEABLE CALLS: how many calls each man could have challenged.
//
// A batter can only challenge a called strike. A catcher can only challenge a
// called ball. So "he asked for a review N times" only becomes a habit against
// the calls he could have asked about. Nothing in the MLB feed counts them, so
// this module counts them from the game feed.
//
// A TAKEN PITCH is a pitch whose details.call.code is C (called strike), B
// (ball) or *B (ball in the dirt). *B is in because the umpire calls it: a ball
// in the dirt is still his call, and a catcher can challenge it. Swings, fouls,
// balls in play, intentional balls (I), pitchouts (P) and automatic balls and
// strikes are out: nobody can challenge them.
//
// THE FEED STORES THE FINAL CALL. After an overturn, a strike reads B and a ball
// reads C. The umpire's ORIGINAL call is the final one, unless that pitch's
// challenge succeeded, then it is the opposite. Flipped pitches come from the
// repo's own challenge reader (selectChallengeState), which already handles play
// level and pitch level reviews and leaves out manager-replay reviews.
//
// A strike is credited to the batter of the plate appearance, for the club that
// was batting. A ball is credited to the catcher of record of the fielding club
// (src/api/catcherOfRecord.js). ACCEPTED LIMIT, inherited from that module: a
// catcher who comes in mid-half is credited from the NEXT half. A half with no
// known catcher credits no catcher (never a guess), but its batters still count.
import { catcherChart } from '../../../src/api/catcherOfRecord.js'
import { selectChallengeState } from '../../../src/api/challenges.js'

const TAKEN = new Set(['C', 'B', '*B'])

// The set of `${atBatIndex}:${pitchNumber}` whose challenge was overturned.
function flippedPitches(feed) {
  const state = selectChallengeState(feed, Infinity, 'bottom')
  const flipped = new Set()
  for (const c of [...state.away.outcomes, ...state.home.outcomes]) {
    if (c.outcome === 'success' && c.pitchNumber != null) flipped.add(`${c.atBatIndex}:${c.pitchNumber}`)
  }
  return flipped
}

// [{ teamId, playerId, role: 'batter' | 'catcher', calls }]. `chart` is
// injectable so a test can supply a hand-built one.
export function challengeableCallsForGame(feed, chart = catcherChart(feed)) {
  const flipped = flippedPitches(feed)
  const totals = new Map()
  const credit = (teamId, playerId, role) => {
    if (teamId == null || playerId == null) return
    const key = `${role}:${teamId}:${playerId}`
    const row = totals.get(key) ?? { teamId, playerId, role, calls: 0 }
    row.calls += 1
    totals.set(key, row)
  }
  const teams = feed?.gameData?.teams
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const { inning, halfInning: half, atBatIndex } = play?.about ?? {}
    const battingSide = half === 'top' ? 'away' : 'home'
    const fieldingSide = half === 'top' ? 'home' : 'away'
    for (const ev of play.playEvents ?? []) {
      const code = ev?.details?.call?.code
      if (!ev?.isPitch || !TAKEN.has(code)) continue
      const wasStrike = (code === 'C') !== flipped.has(`${atBatIndex}:${ev.pitchNumber}`)
      if (wasStrike) credit(teams?.[battingSide]?.id, play.matchup?.batter?.id, 'batter')
      else {
        const catcher = chart.get(`${inning}:${half}`)
        if (catcher?.id) credit(teams?.[fieldingSide]?.id, catcher.id, 'catcher')
      }
    }
  }
  return [...totals.values()]
}

// "DONE, BUT NOBODY FOUND": a game with no rows would be refetched on every
// --backfill-calls run. It gets ONE SENTINEL ROW instead: team_id 0, player_id
// 0, role 'none', 0 calls. No real club or player has id 0, so the export skips
// it, and a game with a sentinel is no longer "missing".
export const NO_CALLS = { teamId: 0, playerId: 0, role: 'none' }

// The write, here so a test can run it. INSERT OR REPLACE on the key, so a
// second write of one game adds nothing.
export function ingestCalls(db, t, rows) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO abs_game_calls
       (season, level, game_pk, team_id, player_id, role, calls)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const list = rows.length ? rows : [{ ...NO_CALLS, calls: 0 }]
  for (const r of list) insert.run(t.season, t.level, t.gamePk, r.teamId, r.playerId, r.role, r.calls)
}

// Ledger games of one season with no row yet (a sentinel counts as a row).
export function gamesMissingCalls(db, season) {
  return db
    .prepare(
      `SELECT g.game_pk, g.season, g.level FROM abs_ingested_games g
       WHERE g.season = ?
         AND NOT EXISTS (SELECT 1 FROM abs_game_calls c WHERE c.game_pk = g.game_pk)
       ORDER BY g.game_pk`,
    )
    .all(season)
}
