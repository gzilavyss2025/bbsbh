import { addDays, toApiDate } from '../../dates.js'
import { teamAbbr } from '../../teams.js'

// World Series mode for the home page (#1906, slice 1). Pure: it reads the
// bracket `usePostseasonBracket(cutoff)` returns and answers one question,
// "is the slate date a World Series date, and which kind of day?".
//
// ON when, HEADING INTO the slate date, both World Series clubs are known and
// the Series is not decided. The bracket already applies the cutoff (ADR-0087):
// a game on the slate date never counts, so the answer holds all day. The day
// after the clincher `decided` is true, mode is off, and the existing champion
// band takes over. The `live` flag (Scores Unlocked) is the bracket's, not
// this function's.
//
// DAY TYPE. A game day is a date the bracket marks `playsOnCutoff`; every
// other mode-on date is an off day. `gameNumber` is the cutoff game's number
// on a game day, and the next game's number on an off day (null when the
// schedule does not name one yet).

export function worldSeriesMode(bracket) {
  const ws = bracket?.worldSeries
  return ws?.decided ? null : seriesMode(ws)
}

// The same shape for one World Series object, with no `decided` gate: the series page shows a
// decided Series too (a decided one has no games ahead, so it reads as an off day with no game).
export function seriesMode(ws) {
  if (!ws) return null
  const slots = ws.slots ?? []
  if (slots.length !== 2 || !slots.every((s) => s?.club)) return null

  if (ws.playsOnCutoff) {
    return { series: ws, dayType: 'game', gameNumber: ws.cutoffGame?.gameNumber ?? null }
  }
  const next = (ws.upcoming ?? []).find((g) => !g.ifNecessary)
  return { series: ws, dayType: 'off', gameNumber: next?.gameNumber ?? null }
}

// The same shape for one postseason-history.json series (the finished page). Every game is
// Final, so nothing is ahead: it reads as an off day with no game. `cutoff` is the day AFTER the
// last game, so every read ends on the Series' last day. Null with no games.
export function historySeriesMode(h) {
  const games = (h.games ?? []).map((g) => ({ gamePk: g.gamePk, gameNumber: g.gameNumber, date: g.date }))
  if (!games.length) return null
  const slots = [h.teamA, h.teamB].map((t) => ({ club: { id: t.teamId, abbreviation: teamAbbr({ id: t.teamId }) }, wins: t.wins }))
  const mode = seriesMode({ slots, games, upcoming: [], playsOnCutoff: false })
  return { mode, cutoff: toApiDate(addDays(new Date(`${games.at(-1).date}T12:00:00`), 1)) }
}

// "NLCS" / "ALCS": the league whose LCS the club played in, from the bracket ('' if none).
export function lcsRoundOf(bracket, clubId) {
  const lg = ['AL', 'NL'].find((l) => bracket.leagues?.[l]?.lcs?.slots.some((s) => s.club?.id === clubId))
  return lg ? `${lg}CS` : ''
}
