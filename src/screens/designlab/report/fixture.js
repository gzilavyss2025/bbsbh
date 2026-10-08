// Invented data for the report-look specimens (#1776). Nothing here is a real
// club's season or a score. The 30 ids only give the rank strip real logos.
export const TEAM_ID = 158
const IDS = [108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158]

// A fixed spread, 1.8 to 8.9, so the rail has a cluster and a tail.
const spread = (i, k) => Math.round((1.8 + ((i * k) % 30) * 0.2386) * 10) / 10
const pool = (k, own) => IDS.map((teamId, i) => ({ teamId, score: teamId === TEAM_ID ? own : spread(i, k) }))

export const LEAGUE_QUALITY = pool(7, 6.9)
export const LEAGUE_SURPRISE = pool(11, 7.6)
export const LEAGUE_FORM = pool(13, 3.4)
export const LEAGUE_GRADE = pool(17, 7.8)

export const SNAPSHOT = {
  season: {
    score: 6.9, wins: 78, losses: 61, runDifferential: 64, pythagWins: 81.2,
    avgParkFactor: 0.97, parkAdjustedRunDifferential: 71, avgOpponentWinPct: 0.498, sosAdjustment: 0.4,
  },
  currentForm: { score: 3.4, games: 10, wins: 4, losses: 6, runDifferential: -9, pythagWins: 3.9 },
}
export const SURPRISE = {
  score: 7.6, residualWins: 6.3, baselineWins: 74.5, baselineKind: 'marcel', expectedWinsToDate: 71.7,
  homeFieldFactor: 0.541, wins: 78, losses: 61,
}

// Challenge file shape: levels.MLB.byTeam[teamId] = one row per man.
const row = (i, pitches, asBatter) => ({
  playerId: 900000 + i, name: `Sample Hitter ${i + 1}`, pitches, asBatter,
  plateAppearances: Math.round(pitches / 3.9), asCatcher: 0, catcherInnings: 0,
})
const club = (k) => Array.from({ length: 9 }, (_, i) => row(i, 2600 - i * 210, Math.round((11 - i * 0.8) * k)))
export const CHALLENGES = {
  levels: {
    MLB: {
      byTeam: Object.fromEntries(IDS.map((id, n) => [String(id), club(id === TEAM_ID ? 0.55 : 0.55 + (n % 9) * 0.13)])),
    },
  },
}
