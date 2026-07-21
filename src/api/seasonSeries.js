// Shapes fetchSeasonSeries' raw rows into the SeasonSeriesStrip's per-cell view
// model, from `viewingTeamId`'s point of view. Pure — no fetch, easy to pin.

import { teamAbbr } from '../lib/teams.js'

// The game matching `currentGamePk` NEVER carries a score, even if the feed
// already reports it Final — that game's own result stays sealed until the
// user reveals it on its own page (see the root spoiler-rule invariant).
// Every OTHER game here is a genuinely different game, already decided or not
// yet played, so its score is fair to show up front.
export function seasonSeriesCells(games, viewingTeamId, currentGamePk) {
  return (games ?? []).map((g) => {
    const isHome = g.homeId === viewingTeamId
    const opponentId = isHome ? g.awayId : g.homeId
    const isCurrent = g.gamePk === currentGamePk
    const final = g.final && !isCurrent
    const hasScores = final && g.awayScore != null && g.homeScore != null
    const winnerId = hasScores
      ? g.awayScore > g.homeScore
        ? g.awayId
        : g.homeScore > g.awayScore
          ? g.homeId
          : null
      : null
    const loserId = winnerId == null ? null : winnerId === g.awayId ? g.homeId : g.awayId

    return {
      gamePk: g.gamePk,
      apiDate: g.apiDate,
      gameDate: g.gameDate,
      tzId: g.tzId,
      gameNumber: g.gameNumber,
      awayId: g.awayId,
      homeId: g.homeId,
      isHome,
      isCurrent,
      final,
      awayAbbr: teamAbbr({ id: g.awayId }),
      homeAbbr: teamAbbr({ id: g.homeId }),
      opponentAbbr: teamAbbr({ id: opponentId }),
      winnerId,
      winnerAbbr: winnerId == null ? null : teamAbbr({ id: winnerId }),
      winnerScore: winnerId == null ? null : Math.max(g.awayScore, g.homeScore),
      loserAbbr: loserId == null ? null : teamAbbr({ id: loserId }),
      loserScore: winnerId == null ? null : Math.min(g.awayScore, g.homeScore),
      // Regulation is 9 — a completed game that ran longer gets its inning
      // count flagged so the strip can show "(10)" etc. next to the score.
      extraInnings: final && g.innings > 9 ? g.innings : null,
    }
  })
}
