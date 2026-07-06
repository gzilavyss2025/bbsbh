// Exited-pitcher box lines.
//
// SPOILER NOTE — read before touching this. A pitcher's line (IP/R/ER/H…) is
// score-revealing, so unlike the rest of the app it is NOT hidden behind a
// SealBox. Its gate is the inning navigator instead: a pitcher only appears
// once the user has advanced PAST his outing (his last inning < the inning
// being viewed). By that point the user has already scored those innings by
// hand, and crucially the current inning is never revealed. This is the one
// deliberate open score display; the two-step split below keeps it honest —
// `computePitcherInnings` reads only who-pitched-when (spoiler-free), and the
// score-revealing stats in `selectExitedPitchers` are read ONLY for pitchers
// that have already cleared the inning gate.

// pitcherId -> { first, last } inning number he threw in, from play-by-play.
// Spoiler-free: it records innings pitched, never outcomes.
export function computePitcherInnings(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const map = {}
  for (const p of plays) {
    const id = p?.matchup?.pitcher?.id
    const inn = p?.about?.inning
    if (!id || !inn) continue
    const e = (map[id] ??= { first: inn, last: inn })
    if (inn < e.first) e.first = inn
    if (inn > e.last) e.last = inn
  }
  return map
}

// Pitchers for `side` who have left the game AND whose final inning is strictly
// before `currentInning` (the inning page the user is on). The pitcher still on
// the mound — the last id in the team's `pitchers` order — is withheld until
// the game is Final. `inningsMap` comes from computePitcherInnings(feed).
export function selectExitedPitchers(feed, side, currentInning, inningsMap) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []

  const ids = team.pitchers ?? []
  if (ids.length === 0) return []

  const isFinal = feed?.gameData?.status?.abstractGameState === 'Final'
  // During a live game the last pitcher used is the one currently in; hold him
  // back so his in-progress line can't leak the inning in play.
  const currentId = isFinal ? null : ids[ids.length - 1]

  const players = feed?.gameData?.players ?? {}
  const boxPlayers = team.players ?? {}

  const out = []
  for (const id of ids) {
    if (id === currentId) continue
    const last = inningsMap[id]?.last
    if (last == null || last >= currentInning) continue

    const person = players[`ID${id}`] ?? {}
    const box = boxPlayers[`ID${id}`] ?? {}
    const s = box.stats?.pitching ?? {}

    out.push({
      id,
      last: (person.lastName ?? person.boxscoreName ?? person.fullName ?? '').trim(),
      first: (person.firstName ?? '').trim(),
      jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
      hand: person.pitchHand?.code ?? '', // 'L' | 'R'
      ip: s.inningsPitched ?? '0.0',
      pitches: s.numberOfPitches ?? s.pitchesThrown ?? 0,
      bf: s.battersFaced ?? 0,
      h: s.hits ?? 0,
      r: s.runs ?? 0,
      er: s.earnedRuns ?? 0,
      bb: s.baseOnBalls ?? 0,
      k: s.strikeOuts ?? 0,
    })
  }
  return out
}
