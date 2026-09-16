// THE NIGHTS A CLUB RAN OUT EARLY — one row per club-game, and the fourth pure
// part of the job behind gen-abs-challenges.mjs (rows.mjs makes the rows,
// bank.mjs replays the bank, chances.mjs counts the denominator, export.mjs
// ships the file).
//
// The club board already carries a `ranOut` column: how many games each club
// emptied its bank in, and how many of those it emptied early. That answers
// "which clubs spend fast" and answers nothing about the nights themselves. A
// club that lost both of its challenges in the FIRST INNING then played eight
// more unable to argue a single pitch, and no per-club count can show that.
//
// WHY THIS IS A BAND AND NOT A TOP TEN. The season on file empties clubs like
// this, counting the FIRST time each club-game reached zero:
//
//   MLB      1st: 9   2nd: 18   3rd: 47   4th: 55   5th: 114 …  1,148 of 4,538
//   Triple-A 1st: 13  2nd: 38   3rd: 60   4th: 85   5th: 155 …  1,378 of 4,298
//
// A top ten of "earliest" would be the first-inning nine plus ONE of the
// second-inning eighteen, picked by nothing. The tie pile is the finding, so
// the board is every club-game in the earliest inning that has any, and the
// distribution is shipped beside it — most clubs that run out do it late, and
// a reader cannot judge the nine without seeing that.
//
// THE ROWS ARE CUT HERE RATHER THAN IN THE READER, which is the one place this
// file departs from the usual split (the reader ranks, the export counts).
// Shipping all 2,526 emptied club-games so the page can show twenty-two of
// them is the mistake ADR-0076 was written about: abs-challenges.json is
// downloaded whole by every visitor to /abs-challenges. So the export ships
// the distribution, which is small, and the rows of the earliest inning only.
// Ordering them, and reading the distribution as shares, stays in the reader.
//
// NOTHING SCORE-SHAPED LEAVES THIS FILE. /abs-challenges is classed
// spoiler-free, and this is the only board on it that names a particular
// night. A challenge is a ball-strike judgment, so the club, the opponent, the
// date, the inning, the call and the miss distance are all safe. A run, a
// winner, a margin or anything one could be read from is not, and the row
// builder below carries no such field — test/abs-challenges.test.js asserts
// the exact key set rather than trusting the reading.

import { replayBank } from './bank.mjs'

// Top before bottom, then the order the rows were written in. The same order
// bank.mjs replays in, kept here because this file needs the sorted list
// itself and not only the replay's verdict.
function inOrder(challenges) {
  return [...challenges].sort(
    (a, b) =>
      a.inning - b.inning ||
      (a.half === 'top' ? 0 : 1) - (b.half === 'top' ? 0 : 1) ||
      (a.seq ?? 0) - (b.seq ?? 0),
  )
}

// One of the two challenges that drained the bank, as the board prints it.
// `callType` is what the plate umpire HAD called — rows.mjs flips it back on an
// overturn — and `missInches` is how far the pitch sat from the nearest edge of
// the buffered zone. Both are null when the pitch could not be resolved, which
// the page draws as an em dash rather than as a zero.
function failCard(row) {
  return {
    playerId: row.player_id ?? null,
    playerName: row.player_name ?? '',
    role: row.role,
    inning: row.inning,
    half: row.half,
    callType: row.call_type ?? null,
    missInches: row.miss_inches ?? null,
  }
}

// One club's night, if it ended in an empty bank. Null when the club never ran
// out, which is most of them.
//
// THE MOMENT COMES OFF THE REPLAY, never off a count of failures. Two lost
// challenges empty a club under today's rule, and `emptiedBy[0]` is the row the
// replay actually spent the last one on — so this board follows the rule into
// extra innings, and keeps following it on the day MLB changes what a club is
// issued. The fails that drained the bank are then every failure up to and
// including that row, which is exactly two in all 8,123 club-games on file and
// is READ rather than assumed.
function nightFor(challenges, game) {
  const ordered = inOrder(challenges)
  const { emptiedIn, emptiedBy } = replayBank(
    ordered,
    game?.final_inning ?? null,
    game?.scheduled_innings ?? null,
  )
  if (emptiedIn.length === 0) return null

  const at = emptiedBy[0]
  const upTo = ordered.slice(0, ordered.indexOf(at) + 1)
  const first = ordered[0]
  return {
    gamePk: first.game_pk,
    date: first.date,
    teamId: first.team_id,
    oppId: first.opp_id ?? null,
    side: first.side,
    // The inning is the replay's, which is the one the club board's `ranOut`
    // column and LAST_EARLY_INNING are both drawn around. The half is the
    // spending row's, because "it was gone before the first inning was over"
    // is the whole point of the earliest band.
    inning: emptiedIn[0],
    half: at.half,
    seq: at.seq ?? 0,
    fails: upTo.filter((c) => c.outcome !== 'success').map(failCard),
  }
}

// EVERY CLUB-GAME THAT EMPTIED, reduced to the distribution and one band.
//
// `clubGames` counts both sides of every swept game, because both sides are
// issued challenges and either could run out — a denominator taken off the
// challenge rows would quietly drop every club nobody challenged for.
//
// The band is ordered earliest-half first, then by the sequence the challenge
// was written in, then by date. That is a TIEBREAK AND NOTHING MORE: every row
// in the band emptied in the same inning, so the order decides which of nine
// equal nights is printed first and claims no more than that.
export function ranOutBoard(rows, games) {
  const byGameTeam = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const gameByPk = new Map(games.map((g) => [g.game_pk, g]))

  const byInning = new Map()
  const nights = []
  for (const [key, challenges] of byGameTeam) {
    const night = nightFor(challenges, gameByPk.get(Number(key.split(':')[0])))
    if (!night) continue
    byInning.set(night.inning, (byInning.get(night.inning) ?? 0) + 1)
    nights.push(night)
  }

  let clubGames = 0
  for (const g of games) {
    if (g.away_team_id != null) clubGames += 1
    if (g.home_team_id != null) clubGames += 1
  }

  const innings = [...byInning.keys()].sort((a, b) => a - b)
  const earliest = innings.length ? innings[0] : null
  const band = nights
    .filter((n) => n.inning === earliest)
    .sort(
      (a, b) =>
        (a.half === 'top' ? 0 : 1) - (b.half === 'top' ? 0 : 1) ||
        a.seq - b.seq ||
        (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
    )

  return {
    clubGames,
    emptied: nights.length,
    byInning: innings.map((inning) => ({ inning, n: byInning.get(inning) })),
    earliest,
    band,
  }
}
