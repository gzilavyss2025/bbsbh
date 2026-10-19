// The Photos card's pure view (#2021). No React, no fetch.
// A photo's headline can read the result (gamePhotos.js), so a game still being played never
// contributes one: `finals` is fetchFinalScores' map, which holds only a Final, scored game. A game
// played today shows its photos once it is over (ADR-0117, which retired ADR-0110).
import { monthDay, photoGameRows } from '../../../../../lib/dates.js'

// The walk reads his game log newest first; game 2 of a doubleheader before game 1.
export const newestFirst = (splits) =>
  [...splits].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.game?.gameNumber ?? 1) - (a.game?.gameNumber ?? 1))

// The games whose photos may load, [{ gamePk, apiDate }], in the order given (photoGameRows' own order loses a doubleheader's).
export function photoGames(splits, finals) {
  const ok = new Set(photoGameRows(splits).map((r) => r.gamePk))
  return splits.filter((s) => ok.has(s.game?.gamePk) && finals.has(s.game.gamePk)).map((s) => ({ gamePk: s.game.gamePk, apiDate: s.date }))
}

// One photo once, by id, in walk order.
export function mergePhotos(have, more) {
  const seen = new Set(have.map((p) => p.id))
  return [...have, ...more.filter((p) => !seen.has(p.id) && seen.add(p.id))]
}

export const photoCell = (p) => ({ id: p.id, href: p.original, thumb: p.thumb, date: monthDay(p.apiDate), caption: p.headline })
