// The postseason series marks: which art a series wears, and when it wears
// none. Each mark prints its year, so a season with no art on file must get
// null (the page keeps its words), never another year's mark.
import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import {
  leagueRoundMark,
  seriesMark,
  seriesMarkForFeed,
  seriesMarkForHistory,
} from '../../src/lib/postseason/seriesMarks.js'
import { results, skeleton } from './fixtures.js'

const publicPath = (src) => fileURLToPath(new URL(`../../public${src}`, import.meta.url))

test('every 2026 round and league resolves to a mark file that exists', () => {
  const cases = [
    ['wildcard', 'AL', 'AL Wild Card'],
    ['wildcard', 'NL', 'NL Wild Card'],
    ['division', 'AL', 'ALDS'],
    ['division', 'NL', 'NLDS'],
    ['lcs', 'AL', 'ALCS'],
    ['lcs', 'NL', 'NLCS'],
    ['worldseries', null, 'World Series'],
  ]
  for (const [round, league, alt] of cases) {
    const mark = seriesMark({ season: 2026, round, league })
    assert.ok(mark, `${round} ${league}`)
    assert.equal(mark.alt, alt)
    assert.ok(existsSync(publicPath(mark.src)), `${mark.src} is on disk`)
  }
})

test('the World Series mark ignores the league', () => {
  assert.equal(
    seriesMark({ season: 2026, round: 'worldseries', league: 'AL' }).src,
    seriesMark({ season: 2026, round: 'worldseries', league: null }).src,
  )
})

test('a season with no art gets no mark, not the 2026 one', () => {
  assert.equal(seriesMark({ season: 2025, round: 'lcs', league: 'AL' }), null)
  assert.equal(seriesMark({ season: 2027, round: 'worldseries', league: null }), null)
})

test('a round below the World Series needs its league', () => {
  assert.equal(seriesMark({ season: 2026, round: 'division', league: null }), null)
  assert.equal(seriesMark({ season: 2026, round: 'nope', league: 'AL' }), null)
  assert.equal(seriesMark(null), null)
})

test('the season may arrive as a string', () => {
  assert.ok(seriesMark({ season: '2026', round: 'lcs', league: 'NL' }))
})

test('a live feed resolves by game type, season and the home club league', () => {
  const feed = (type, leagueId, season = '2026') => ({
    gameData: { game: { type, season }, teams: { home: { league: { id: leagueId } } } },
  })
  assert.equal(seriesMarkForFeed(feed('F', 103)).alt, 'AL Wild Card')
  assert.equal(seriesMarkForFeed(feed('D', 104)).alt, 'NLDS')
  assert.equal(seriesMarkForFeed(feed('L', 103)).alt, 'ALCS')
  assert.equal(seriesMarkForFeed(feed('W', 104)).alt, 'World Series')
})

test('a regular-season, spring or past-season feed gets no mark', () => {
  const feed = (type, season = '2026') => ({
    gameData: { game: { type, season }, teams: { home: { league: { id: 103 } } } },
  })
  assert.equal(seriesMarkForFeed(feed('R')), null)
  assert.equal(seriesMarkForFeed(feed('S')), null)
  assert.equal(seriesMarkForFeed(feed('A')), null)
  assert.equal(seriesMarkForFeed(feed('L', '2025')), null)
  assert.equal(seriesMarkForFeed(null), null)
  assert.equal(seriesMarkForFeed({}), null)
})

test('a history series resolves by year, round key and league id', () => {
  assert.equal(seriesMarkForHistory({ year: 2026, roundKey: 'division', leagueId: 104 }).alt, 'NLDS')
  assert.equal(seriesMarkForHistory({ year: 2026, roundKey: 'worldseries', leagueId: null }).alt, 'World Series')
  assert.equal(seriesMarkForHistory({ year: 2025, roundKey: 'division', leagueId: 104 }), null)
})

// ---------------------------------------------------------------------------
// The home bracket's league heading: the mark of the round each league is
// playing, heading into the cutoff date. The real 2025 postseason, relabelled
// 2026 (the first season with art on file).
// ---------------------------------------------------------------------------

const bracketAsOf = (cutoff) => ({ ...deriveBracket(skeleton(2025), results(2025), cutoff), season: 2026 })
const headings = (cutoff) => {
  const b = bracketAsOf(cutoff)
  return [leagueRoundMark(b, 'AL')?.alt, leagueRoundMark(b, 'NL')?.alt]
}

test('league heading: the Wild Card mark before any game is played', () => {
  assert.deepEqual(headings('2025-09-30'), ['AL Wild Card', 'NL Wild Card'])
})

test('league heading: one Wild Card series over is not enough to move on', () => {
  // Heading into 10-02, LAD had swept CIN but CHC-SD still had a Game 3 to play.
  const nlWildCard = bracketAsOf('2025-10-02').leagues.NL.wildcard
  assert.deepEqual(nlWildCard.map((s) => s.decided).sort(), [false, true])
  assert.deepEqual(headings('2025-10-02'), ['AL Wild Card', 'NL Wild Card'])
})

test('league heading: the Division Series mark once both Wild Card series are over', () => {
  assert.deepEqual(headings('2025-10-03'), ['ALDS', 'NLDS'])
})

test('league heading: each league moves on by itself', () => {
  // The last ALDS game (SEA over DET, Game 5) was 10-10; the last NLDS game
  // (MIL over CHC, Game 5) was 10-11. So heading into 10-11 the AL has moved
  // on and the NL has not.
  assert.deepEqual(headings('2025-10-10'), ['ALDS', 'NLDS'])
  assert.deepEqual(headings('2025-10-11'), ['ALCS', 'NLDS'])
  assert.deepEqual(headings('2025-10-12'), ['ALCS', 'NLCS'])
})

test('league heading: a league that has won its pennant keeps its LCS mark', () => {
  // LAD swept the NLCS on 10-17; TOR took the ALCS in 7 on 10-20.
  const b = bracketAsOf('2025-10-18')
  assert.equal(b.leagues.NL.lcs.decided, true)
  assert.equal(b.leagues.AL.lcs.decided, false)
  assert.deepEqual(headings('2025-10-18'), ['ALCS', 'NLCS'])
  assert.deepEqual(headings('2025-10-30'), ['ALCS', 'NLCS'])
})

test('league heading: no mark for a season with no art, or no bracket', () => {
  const b = deriveBracket(skeleton(2025), results(2025), '2025-10-03')
  assert.equal(leagueRoundMark(b, 'AL'), null)
  assert.equal(leagueRoundMark(null, 'AL'), null)
})
