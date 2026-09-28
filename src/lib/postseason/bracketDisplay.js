// Pure layout helpers over a derived bracket (#1224, slice 5: the bracket on
// the home page). Each reads only the shape docs/api/postseason.md defines —
// nothing here fetches, and nothing reads a cutoff of its own; the bracket
// handed in is already heading into its cutoff date (ADR-0087).

// The series playing on the cutoff date — the folded view's "today" tickets.
// A decided series never plays again, so `playsOnCutoff` alone is the test
// (bracket.js clears it once a series is decided).
export function seriesPlayingToday(bracket) {
  return bracket?.series?.filter((s) => s.playsOnCutoff) ?? []
}

// Every club still alive in the bracket heading into the cutoff: named in
// some series' slot and not that series' `eliminated` club. Includes a club
// waiting on a bye or a later round, and the champion once the World Series
// is decided — "alive" is not the same question as "plays today".
export function aliveClubs(bracket) {
  const alive = new Map()
  for (const s of bracket?.series ?? []) {
    for (const slot of s.slots) if (slot.club) alive.set(slot.club.id, slot.club)
  }
  for (const s of bracket?.series ?? []) {
    if (s.eliminated) alive.delete(s.eliminated.id)
  }
  return [...alive.values()]
}

// The postseason window's Off Day grid (Gary's decision, 2026-09-28): alive
// clubs with no game on the cutoff date. `playingIds` is the slate's own set
// of club ids with a game that date — GameSelect already builds this set for
// the regular-season grid, so this only narrows it.
export function offDayAliveTeams(bracket, playingIds) {
  return aliveClubs(bracket).filter((c) => !playingIds?.has(c.id))
}

// The series a bracket slot feeds from, for a blank slot's screen-reader
// label ("Winner of NLDS 'A', to come") — never the word "TBD" (the brief's
// theme: a future slot is a blank ruled line). `key` is a slot's `from`.
export function feederSeries(bracket, key) {
  return bracket?.series?.find((s) => s.key === key) ?? null
}

// A genuine winner-take-all decider: both clubs known and each exactly one
// win from taking the series (1-1 of 3, 2-2 of 5, 3-3 of 7). Distinct from
// `isElimination` below, which allows an asymmetric score.
export function isDecidingGame(series) {
  if (!series || series.decided) return false
  const [a, b] = series.slots
  if (!a.club || !b.club) return false
  const n = series.winsNeeded - 1
  return a.wins === n && b.wins === n
}

// One club is a single loss from being out, whether or not the series is
// also a symmetric decider. Excludes a series already decided.
export function isElimination(series) {
  if (!series || series.decided) return false
  const [a, b] = series.slots
  if (!a.club || !b.club) return false
  const n = series.winsNeeded - 1
  return a.wins === n || b.wins === n
}

// The brief's "one bold moment": a deciding game or an elimination game,
// playing on the cutoff date. Everything else about the bracket stays quiet.
export function isBoldMoment(series) {
  return Boolean(series?.playsOnCutoff) && (isDecidingGame(series) || isElimination(series))
}
