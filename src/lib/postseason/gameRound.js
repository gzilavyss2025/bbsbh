// The round a postseason game belongs to, as words: "ALDS", "NLCS", "World Series",
// "AL Wild Card", and with the series game number, "ALDS \u00b7 Game 3". The print sheet
// and the preview poster print it.
//
// Every part is a PREGAME fact. The live feed names the round (`gameData.game.type`)
// and the home club's league, and the schedule row names the game number
// (`seriesGameNumber`; the feed does not carry it). Checked live on gamePk 849829
// (2026-10-03, ALDS Game 1): type 'D', home league 103, seriesGameNumber 1. A round
// name and a game number say nothing about how an earlier game ended. A series
// record ("leads 2-1") is a result and never belongs here (ADR-0087).
import { altFor, LEAGUE_BY_ID, ROUND_BY_GAME_TYPE } from './seriesMarks.js'

// The round as the series page and slate card print it, with the league spelled
// out when the home club's league is missing from the feed.
const PLAIN = {
  wildcard: 'Wild Card',
  division: 'Division Series',
  lcs: 'League Championship Series',
  worldseries: 'World Series',
}

// '' for any game that is not a postseason game.
export function feedRoundName(feed) {
  const round = ROUND_BY_GAME_TYPE[feed?.gameData?.game?.type]
  if (!round) return ''
  const league = LEAGUE_BY_ID[feed?.gameData?.teams?.home?.league?.id]
  return league || round === 'worldseries' ? altFor(round, league) : PLAIN[round]
}

// "ALDS \u00b7 Game 3". The game number is optional (it arrives after a schedule
// read); with no round name there is no line at all.
export function roundLine(name, seriesGameNumber) {
  if (!name) return ''
  return seriesGameNumber ? `${name} \u00b7 Game ${seriesGameNumber}` : name
}

// The same line from a SCHEDULE row hydrated with `team` (the link-preview card reads
// that row, not the live feed). `gameType`, the home club's league and
// `seriesGameNumber` are all pregame facts; the row's series record is never read.
// '' for any game that is not a postseason game.
export function scheduleRoundLine(game) {
  return roundLine(scheduleRoundName(game), game?.seriesGameNumber)
}

// "ALDS \u2022 G1", the short form a stat tile has room for (/abs-challenges' biggest
// postseason overturn, #1514). Same schedule row and the same pregame facts.
export function roundShort(game) {
  const name = scheduleRoundName(game)
  return name && game?.seriesGameNumber ? `${name} \u2022 G${game.seriesGameNumber}` : name
}

function scheduleRoundName(game) {
  return feedRoundName({
    gameData: { game: { type: game?.gameType }, teams: { home: { league: game?.teams?.home?.team?.league } } },
  })
}

// The tab title: "CWS @ CLE · ALDS · Game 3 · Box score". The round sits after the
// matchup so a tab strip still reads the clubs first. No round, no change.
export function titleWithRound(matchup, section, round) {
  return [matchup, round, section].filter(Boolean).join(' \u00b7 ')
}
