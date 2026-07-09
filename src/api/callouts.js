// Per-game "call-out" enrichment, read from a static same-origin file
// (public/data/callouts/<MMDDYYYY>.json) rather than assembled live.
//
// The file is precomputed the night before by scripts/gen-callouts.mjs (see
// .github/workflows/update-callouts.yml) for that day's MLB slate — season
// leaders, streaks, and situational team records for every club playing, joined
// per gamePk. Same build-time-fetch pattern as war.js / minors-leaders.js; every
// value in it is a SEASON AGGREGATE, so it's spoiler-free — the app's
// spoiler-safety comes from WHERE each note renders (inside a revealed play card,
// or on an extras page), never from this data.
//
// Degrades to an empty games map before the file exists or on any failure — a
// game with no bundle simply shows no notes (MiLB games, un-generated dates, a
// failed nightly run). Cached in-memory per date for the session, since a given
// day's file only changes once (the pre-dawn cron).
const cache = new Map() // urlDate (MMDDYYYY) -> { games }

export async function fetchCallouts(urlDate) {
  if (!urlDate) return { games: {} }
  if (cache.has(urlDate)) return cache.get(urlDate)
  let result = { games: {} }
  try {
    const res = await fetch(`/data/callouts/${urlDate}.json`)
    if (res.ok) {
      const data = await res.json()
      result = { games: data.games ?? {} }
    }
  } catch {
    // leave the empty default — no notes rather than a broken view
  }
  cache.set(urlDate, result)
  return result
}

// This game's bundle, or null when the file didn't cover it. Shape (all keys
// present, values possibly empty):
//   { away:{teamId,name}, home:{teamId,name},
//     leaders:{ [playerId]: { team, cats:{ hr, doubles, ... } } },
//     pitcherLeaders:{ [playerId]: { team, cats:{ so_p } } },
//     streaks:{ [playerId]: { onBase?, stolenBase? } },
//     homerRecords:{ [playerId]: 'W-L' },
//     teamRecords:{ away:{extraInning,oneRun,scoringFirst,opponentScoringFirst}, home:{…} } }
export function calloutsForGame(data, gamePk) {
  return data?.games?.[gamePk] ?? null
}
