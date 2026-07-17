// Classifies a completed game's late-innings drama from its per-inning
// linescore: did a team hold a lead from the 8th inning on (incl. extras)
// and lose it (a blown lead), or trail/tie that late and still win (a
// clutch win, incl. walk-offs and go-ahead road wins that hold)? Pure, no
// node imports — read by the nightly gen-team-score.mjs precompute.
export const LATE_INNING_START = 8

// Half-inning-granular: a lead can flip within a single inning (tied in the
// top of the 9th, answered right back in the bottom), so this walks every
// half-inning boundary from LATE_INNING_START on rather than comparing only
// between full innings.
export function classifyLateGame({ innings, homeRuns, awayRuns, lateInningStart = LATE_INNING_START }) {
  let homeCum = 0
  let awayCum = 0
  const diffs = [] // home-minus-away score BEFORE each late half-inning is played
  for (const inning of innings ?? []) {
    if (inning.num >= lateInningStart) diffs.push(homeCum - awayCum)
    awayCum += inning.away?.runs ?? 0
    if (inning.num >= lateInningStart) diffs.push(homeCum - awayCum)
    homeCum += inning.home?.runs ?? 0
  }

  const homeWon = homeRuns > awayRuns
  const homeMaxLead = Math.max(0, ...diffs)
  const awayMaxLead = Math.max(0, ...diffs.map((d) => -d))
  const homeEverBehindOrTied = diffs.some((d) => d <= 0)
  const awayEverBehindOrTied = diffs.some((d) => d >= 0)

  return {
    home: {
      blownLead: !homeWon && homeMaxLead > 0,
      blownLeadRuns: !homeWon ? homeMaxLead : 0,
      clutchWin: homeWon && homeEverBehindOrTied,
      clutchWinRuns: homeWon && homeEverBehindOrTied ? awayMaxLead : 0,
    },
    away: {
      blownLead: homeWon && awayMaxLead > 0,
      blownLeadRuns: homeWon ? awayMaxLead : 0,
      clutchWin: !homeWon && awayEverBehindOrTied,
      clutchWinRuns: !homeWon && awayEverBehindOrTied ? homeMaxLead : 0,
    },
  }
}
