// Shapes fetchSeasonSeries' raw rows into the SeasonSeriesStrip's per-cell view
// model, from `viewingTeamId`'s point of view. Pure — no fetch, easy to pin.

import { teamAbbr } from '../lib/teams.js'
import { extraInningsOf } from './select.js'

// The postseason round a schedule row's gameType names — the same four short
// tags the rest of the app prints (WC / DS / LCS / WS). Anything else, the
// regular season included, is null.
const ROUND_TAG = { F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }

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
      // A postseason game's round tag and its place in that series ("G2"); both
      // null for a regular-season game. A fact about the schedule, not a result.
      round: ROUND_TAG[g.gameType] ?? null,
      seriesGame: ROUND_TAG[g.gameType] ? (g.seriesGameNumber ?? null) : null,
      awayId: g.awayId,
      homeId: g.homeId,
      isHome,
      isCurrent,
      final,
      // A completed game can still lack a decisive score — a suspended/curfew
      // tie, or a feed that hasn't posted both sides' runs yet. Keyed on
      // `winnerId` (not just both scores being present) so a genuine tie also
      // reports false — distinct from `final` so the strip can render a plain
      // "Final" label instead of a blank logo + score when there's no winner.
      hasScore: winnerId != null,
      awayAbbr: teamAbbr({ id: g.awayId }),
      homeAbbr: teamAbbr({ id: g.homeId }),
      opponentAbbr: teamAbbr({ id: opponentId }),
      winnerId,
      winnerAbbr: winnerId == null ? null : teamAbbr({ id: winnerId }),
      winnerScore: winnerId == null ? null : Math.max(g.awayScore, g.homeScore),
      loserAbbr: loserId == null ? null : teamAbbr({ id: loserId }),
      loserScore: winnerId == null ? null : Math.min(g.awayScore, g.homeScore),
      // A completed game that ran past its scheduled length gets its inning
      // count flagged so the strip can show "(10)" etc. next to the score.
      extraInnings: final ? extraInningsOf(g.innings, g.scheduledInnings) : null,
    }
  })
}

// The two clubs' head-to-head record so far this REGULAR season, tallied from
// the same cells the strip already built — every decided regular-season leg
// (a postseason game sits in the strip under its own round tag and is not
// part of this tally) but never the
// game `currentGamePk` masks (seasonSeriesCells already stripped its score,
// so it never counts either way). `{ aWins: 0, bWins: 0 }` before anything's
// been decided.
export function seasonSeriesRecord(cells, teamAId, teamBId) {
  let aWins = 0
  let bWins = 0
  for (const c of cells) {
    if (!c.hasScore || c.round) continue
    if (c.winnerId === teamAId) aWins++
    else if (c.winnerId === teamBId) bWins++
  }
  return { aWins, bWins }
}
