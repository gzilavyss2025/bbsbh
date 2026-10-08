// One finished game, the shape the primer's loaders produce (slices 2 and 3)
// and the primer's parts read (slice 4):
//   {
//     gamePk, n, date,         // n is the game number in the series
//     awayId, homeId,
//     venueId, venueName,
//     runs: { away, home },
//     wp: number[],            // at most 26 home win-chance points
//   }
// Only a game dated before the cutoff may have one (ADR-0087).

// The series ribbon: one node per game, 1 to bestOf, from the bracket's own
// buckets (src/api/postseason/bracket.js):
//   played       a counted game (series.games). Runs come from scoresByPk, the
//                winner and the record after the game from the bracket.
//   today        series.cutoffGame. No score, even when scoresByPk has one.
//   ahead        a dated game still to play.
//   ifNecessary  no date, no gamePk, no park: the row must read the same
//                whether or not the game is played.
import { recordLine } from '../../../api/postseason/text.js'

export function ribbonNodes(series, { scoresByPk = {} } = {}) {
  return Array.from({ length: series.bestOf }, (_, i) => {
    const n = i + 1
    const game = series.games.find((g) => g.gameNumber === n)
    if (game) return playedNode(series, game, scoresByPk[game.gamePk])
    if (series.cutoffGame?.gameNumber === n) return { kind: 'today', n, gamePk: series.cutoffGame.gamePk }
    const next = series.upcoming.find((g) => g.gameNumber === n)
    if (next?.date) return { kind: 'ahead', n, gamePk: next.gamePk, date: next.date }
    return { kind: 'ifNecessary', n }
  })
}

function playedNode(series, game, score) {
  const sofar = series.games.filter((g) => g.gameNumber <= game.gameNumber)
  const slots = series.slots.map((slot) => ({ ...slot, wins: sofar.filter((g) => g.winnerId === slot.club.id).length }))
  return {
    kind: 'played',
    n: game.gameNumber,
    gamePk: game.gamePk,
    date: game.date,
    winnerId: game.winnerId,
    // `decided` is the series' end state: only its last game reads as the result.
    record: recordLine({ ...series, slots, gamesPlayed: sofar.length, decided: series.decided && sofar.length === series.games.length }),
    runs: score ? series.slots.map((slot) => (slot.club.id === score.awayId ? score.runs.away : score.runs.home)) : null,
    score: score ?? null,
  }
}
