// Score-revealing selectors. IMPORTANT (spoiler rule): callers must only
// invoke these when the user has tapped to reveal — the returned numbers must
// never be rendered into the DOM while a box is still sealed.

// Per-inning, per-side R / H / E / LOB straight from the linescore. `side` is
// 'away' or 'home'; `inningNum` is 1-based.
export function revealInning(feed, inningNum, side) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  const inning = innings.find((i) => i.num === inningNum)
  const half = inning?.[side]
  if (!half) return null
  return {
    runs: half.runs ?? 0,
    hits: half.hits ?? 0,
    errors: half.errors ?? 0,
    leftOnBase: half.leftOnBase ?? 0,
  }
}

// Full-game R / H / E / LOB totals for the global reveal — the box score's
// LineTotals card reads this directly rather than re-deriving the same
// liveData.linescore.teams[side] fields itself (see boxscore.js's teamLine).
export function revealTotals(feed, side) {
  const t = feed?.liveData?.linescore?.teams?.[side]
  if (!t) return null
  return {
    runs: t.runs ?? 0,
    hits: t.hits ?? 0,
    errors: t.errors ?? 0,
    leftOnBase: t.leftOnBase ?? 0,
  }
}

// Everything a Logbook stamp needs to draw itself, in the exact shape
// `api/stamps.js` caches under `game:final:{gamePk}` — so one GameStamp
// component renders from either source and the two can't drift.
//
// Reveal-only, and emphatically so: it returns the final score. The one caller
// is the stamp affordance inside the box score's SealBox reveal render
// (StampGameButton, via BoxScore.jsx), which is what makes it safe — read
// ADR-0035 before adding a second.
//
// `innings` and `homeBattedLast` are the two fields the server's reveal gate
// turns on (`finalHalfIndex` in src/lib/stamps.js), so they must agree with what
// the SERVER derived from the schedule feed. That is why the last inning is
// found by scanning for the last row anyone actually batted in rather than
// taking `innings.length`: the schedule's linescore stops at the last played
// inning, but the live feed PADS its array out to `scheduledInnings` with empty
// rows. A rain-shortened game (verified against gamePk 824807, 2026-08-02
// PHI@BAL, "Completed Early: Rain" after 5 1/2) has a 9-long array whose last
// five rows carry no `runs` at all — reading its length would claim nine innings
// and demand a half nobody played.
export function revealStampFacts(feed) {
  if (!feed?.gamePk && !feed?.gameData) return null
  const gameData = feed?.gameData ?? {}
  const line = feed?.liveData?.linescore ?? {}
  const rows = Array.isArray(line.innings) ? line.innings : []

  let last = null
  for (const row of rows) {
    if (typeof row?.away?.runs === 'number' || typeof row?.home?.runs === 'number') last = row
  }
  const innings = Number.isInteger(last?.num) ? last.num : 0
  // The same test liveEdge.js's edgeFromLinescore makes: a home entry carrying
  // an actual number means the bottom half was reached. A home club leading
  // after the top of the last inning never bats again.
  const homeBattedLast = typeof last?.home?.runs === 'number'

  const side = (key) => {
    const team = gameData.teams?.[key] ?? {}
    const totals = line.teams?.[key] ?? {}
    return {
      id: team.id ?? null,
      abbreviation: team.abbreviation ?? '',
      name: team.name ?? '',
      runs: typeof totals.runs === 'number' ? totals.runs : null,
      hits: typeof totals.hits === 'number' ? totals.hits : null,
      errors: typeof totals.errors === 'number' ? totals.errors : null,
    }
  }
  const away = side('away')
  const home = side('home')
  const winnerId =
    away.runs == null || home.runs == null || away.runs === home.runs
      ? null
      : away.runs > home.runs
        ? away.id
        : home.id

  return {
    gamePk: feed?.gamePk ?? gameData.game?.pk ?? null,
    date: gameData.datetime?.officialDate ?? '',
    gameNumber: Number.isInteger(gameData.game?.gameNumber) ? gameData.game.gameNumber : 1,
    sportId: gameData.teams?.home?.sport?.id ?? 1,
    gameType: gameData.game?.type ?? 'R',
    venue: gameData.venue?.name ?? '',
    innings,
    homeBattedLast,
    status: gameData.status?.abstractGameState ?? '',
    away,
    home,
    winnerId,
  }
}

// Runs THROUGH the reveal mark for one side — the "score as of your own
// reveal progress" figure RollingLine's own running-line total already shows
// (its per-side `totals()`), exposed here so another reveal-gated surface
// (the scorebug) can read the same number without re-deriving it a second
// way inline. Deliberately NOT `revealTotals` above, which is the FULL-GAME
// final and would spoil a game the user hasn't finished revealing — this
// sums only the innings whose BATTING half (the side's own half-type: top
// for away, bottom for home) is at or below `revealedThrough`, same gate
// RollingLine's `r`/`h` totals use.
export function revealRunsThrough(feed, unlocked, revealedThrough, side) {
  const battingHalf = side === 'away' ? 'top' : 'bottom'
  let r = 0
  for (let n = 1; n <= unlocked; n++) {
    const idx = (n - 1) * 2 + (battingHalf === 'top' ? 0 : 1)
    if (idx > revealedThrough) continue
    r += revealInning(feed, n, side)?.runs ?? 0
  }
  return r
}
