// MLB's postseason series marks — "ALDS", "NLCS", "World Series" — keyed by
// season, round and league. Each mark prints its year, so the table is per
// season: a season with no art on file returns null and the caller keeps its
// words. Never fall back to another year's mark.
//
// The art is white-on-navy. A caller draws it on a navy band it already has
// (the series page's banner, the slate card's series line) or on
// SeriesMark's own navy plate — never straight on paper.
//
// A mark names the round only, which every surface that draws one already
// says in words. It carries no score, so it needs no seal.
//
// Files: public/postseason-marks/{season}/, each cropped to the mark alone
// (no sponsor or network line) at a MARK_FILE_HEIGHT (192px) height, width floating
// per mark. Each entry is [file, width in px]; SeriesMark hands both to the <img> as
// its width/height attributes, so the browser reserves the box before the file loads
// and nothing beside a mark moves when it lands (#2984).

import { leaguePhase } from './bracketDisplay.js'

export const MARK_FILE_HEIGHT = 192

const FILES = {
  2026: {
    'wildcard:AL': ['al-wild-card', 618],
    'wildcard:NL': ['nl-wild-card', 618],
    'division:AL': ['alds', 402],
    'division:NL': ['nlds', 393],
    'lcs:AL': ['alcs', 384],
    'lcs:NL': ['nlcs', 374],
    worldseries: ['world-series', 275],
  },
}

export const ROUND_BY_GAME_TYPE = { F: 'wildcard', D: 'division', L: 'lcs', W: 'worldseries' }
export const LEAGUE_BY_ID = { 103: 'AL', 104: 'NL' }

// The words a mark stands for — the same round titles the slate card prints.
export function altFor(round, league) {
  if (round === 'worldseries') return 'World Series'
  if (round === 'wildcard') return `${league} Wild Card`
  if (round === 'division') return `${league}DS`
  return `${league}CS`
}

// { src, alt } for one series, or null. `round` is bracket.js's key
// (wildcard/division/lcs/worldseries); `league` is 'AL' or 'NL', ignored for
// the World Series.
export function seriesMark(series) {
  const { season, round, league } = series ?? {}
  const table = FILES[Number(season)]
  if (!table || !round) return null
  const key = round === 'worldseries' ? round : `${round}:${league}`
  if (!table[key]) return null
  const [file, width] = table[key]
  return { src: `/postseason-marks/${Number(season)}/${file}.png`, alt: altFor(round, league), width, height: MARK_FILE_HEIGHT }
}

// A game's live feed: its game type and season, and the home club's league
// (both clubs share one below the World Series).
export function seriesMarkForFeed(feed) {
  const game = feed?.gameData?.game
  return seriesMark({
    season: game?.season,
    round: ROUND_BY_GAME_TYPE[game?.type],
    league: LEAGUE_BY_ID[feed?.gameData?.teams?.home?.league?.id],
  })
}

// One series from postseason-history.json, as findSeriesById returns it.
export function seriesMarkForHistory(series) {
  return seriesMark({
    season: series?.year,
    round: series?.roundKey,
    league: LEAGUE_BY_ID[series?.leagueId],
  })
}

// The round a league's bracket heading wears: the one it is playing heading
// into the cutoff, moving on only once EVERY series of the round in that
// league is decided, and keeping its LCS mark after the pennant. Each league
// moves on by itself. `leagueKey` is 'AL' or 'NL'.
const HEADING_ROUND = { wildcard: 'wildcard', division: 'division', lcs: 'lcs', done: 'lcs' }

export function leagueRoundMark(bracket, leagueKey) {
  const league = bracket?.leagues?.[leagueKey]
  if (!league) return null
  return seriesMark({ season: bracket.season, round: HEADING_ROUND[leaguePhase(league)], league: leagueKey })
}
