// PITCHES RECEIVED: how many pitches each catcher caught, per club, per game.
//
// Nothing in the MLB feed counts this. The roster call carries innings caught
// (exposure.mjs), which is a stand-in. So this module counts it from the game
// feed: every pitch of every play goes to the catcher of record of the club that
// was FIELDING that half (src/api/catcherOfRecord.js).
//
// ACCEPTED LIMIT, inherited whole from catcherOfRecord.js: a catcher who comes
// in mid-half is credited from the NEXT half. A half with no known catcher
// credits nobody. This module never guesses.
//
// The rows feed the `pitchesReceived` field of the per-club exposure file
// (buildExposureClubsExport in export.mjs). The sweep writes them with each new
// game, and `--backfill-received` fills the games swept before this existed.
import { catcherChart } from '../../../src/api/catcherOfRecord.js'

// The top half is fielded by the home club, the bottom half by the away club.
function fieldingTeamId(feed, half) {
  const side = half === 'top' ? 'home' : 'away'
  return feed?.gameData?.teams?.[side]?.id ?? feed?.liveData?.boxscore?.teams?.[side]?.team?.id ?? null
}

// [{ teamId, playerId, pitches }], one row per club and catcher. `chart` is
// injectable so a test can supply a hand-built one; the default reads the feed.
export function pitchesReceivedForGame(feed, chart = catcherChart(feed)) {
  const totals = new Map()
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    const catcher = chart.get(`${inning}:${half}`)
    if (!catcher?.id) continue
    const teamId = fieldingTeamId(feed, half)
    if (teamId == null) continue
    const pitches = (play.playEvents ?? []).filter((e) => e?.isPitch).length
    const key = `${teamId}:${catcher.id}`
    const row = totals.get(key) ?? { teamId, playerId: catcher.id, pitches: 0 }
    row.pitches += pitches
    totals.set(key, row)
  }
  return [...totals.values()]
}

// "DONE, BUT NOBODY CAUGHT": a game whose feed names no catcher at all (a thin
// MiLB feed) would have no rows, so --backfill-received would refetch it on
// every run. It gets ONE SENTINEL ROW instead, team_id 0 and player_id 0 with 0
// pitches. No real club or player has id 0, so the export skips it, and a game
// with a sentinel is no longer "missing". A column on abs_ingested_games was the
// other option, but it would change a table the three older dumps already hold.
export const NO_CATCHER = { teamId: 0, playerId: 0 }

// The write, here so a test can run it. INSERT OR REPLACE on the key, so a
// second write of one game adds nothing.
export function ingestReceived(db, t, rows) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO abs_catcher_pitches
       (season, level, game_pk, team_id, player_id, pitches)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const list = rows.length ? rows : [{ ...NO_CATCHER, pitches: 0 }]
  for (const r of list) insert.run(t.season, t.level, t.gamePk, r.teamId, r.playerId, r.pitches)
}

// Ledger games of one season with no row yet (a sentinel counts as a row).
export function gamesMissingReceived(db, season) {
  return db
    .prepare(
      `SELECT g.game_pk, g.season, g.level FROM abs_ingested_games g
       WHERE g.season = ?
         AND NOT EXISTS (SELECT 1 FROM abs_catcher_pitches c WHERE c.game_pk = g.game_pk)
       ORDER BY g.game_pk`,
    )
    .all(season)
}
