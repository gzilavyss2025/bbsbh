// The "wsEvents" block of a nightly callouts shard (scripts/gen-callouts.mjs): the notable events
// of the current World Series' counted games, classified by the same code that built
// public/data/world-series/events.json (lib/worldSeries/classify.js). The live "last time" notes
// read the current Series from here instead of a static file (ADR-0087).
//
// Same cutoff as seriesBlock.js: only games dated before the bracket's cutoff (the slate date)
// are classified, so no event from the slate date or later can be in it. `wta` says tonight's game
// is winner-take-all (both clubs one win short), which the 9th-inning note needs.
//
// dataByPk: { [gamePk]: { box } } (the /boxscore, for the club ids). pbpByPk: { [gamePk]: the
// /playByPlay body }. Returns null outside the World Series, or when a counted game has no
// play-by-play or box: no block is better than a block that is short a game.
import { seriesForGame } from '../../../api/postseason/bracket.js'
import { classifyGame } from '../../worldSeries/classify.js'

export function wsEventsBlock(bracket, gamePk, dataByPk, pbpByPk) {
  const series = seriesForGame(bracket, gamePk)?.series
  if (series?.round !== 'worldseries') return null
  const counted = series.games.filter((g) => g.date < bracket.cutoff)
  if (counted.some((g) => !pbpByPk[g.gamePk] || !dataByPk[g.gamePk]?.box)) return null
  const events = counted.flatMap((g) => {
    const { away, home } = dataByPk[g.gamePk].box.teams
    return classifyGame(pbpByPk[g.gamePk], {
      clubs: { away: away.team.id, home: home.team.id },
      game: { pk: g.gamePk, date: g.date, season: Number(g.date.slice(0, 4)), n: g.gameNumber },
    })
  })
  return { events, wta: series.slots.every((s) => s.wins === series.winsNeeded - 1) }
}

// The counted games of every World Series on the slate (the games whose play-by-play the block needs).
export const wsCountedPks = (bracket, slatePks) => [...new Set(slatePks.flatMap((pk) => {
  const series = seriesForGame(bracket, pk)?.series
  return series?.round === 'worldseries' ? series.games.map((x) => x.gamePk) : []
}))]
