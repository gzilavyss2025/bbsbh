import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { factsRecord, heritagePassModel, passCity, passDate, passPage, passRecordText, yearRecordThrough } from '../src/lib/heritage/pass.js'
import { stampGameFacts } from '../src/api/logbook.js'
import { revealStampFacts } from '../src/api/linescore.js'
import { parseRoute } from '../src/lib/route.js'
import { badgeFieldPins, secondaryLogoSvg } from '../src/lib/heritage/marks.js'
import { recordAfterGame } from '../src/lib/stamps.js'
import { heritageArt } from '../src/lib/heritage/art.js'
import { logoCdnUrl } from '../src/lib/logoCdn.js'

const fixtures = JSON.parse(readFileSync(new URL('../src/screens/heritage/fixtures.json', import.meta.url)))
const regular = fixtures[0].game

test('captured regular-season and postseason records use the existing stamp contract', () => {
  assert.equal(heritagePassModel(regular).occasion, 'Regular season')
  const post = heritagePassModel(fixtures[1].game)
  assert.equal(post.occasion, 'World Series')
  assert.equal(post.seriesGame, 1)
  assert.equal(post.postseason, true)
  assert.equal(heritagePassModel(fixtures[2].game).classification, 'AAA')
  assert.equal(heritagePassModel(regular).leagueMark, 'mlb')
  assert.equal(heritagePassModel(fixtures[2].game).leagueMark, 'milb')
  assert.equal(heritagePassModel(fixtures[2].game).levelName, 'Triple-A')
})

test('unknown competition stays unknown and a doubleheader number is never a series game', () => {
  const result = heritagePassModel({ ...regular, sportId: null, gameType: null, venue: '', date: '' })
  assert.equal(result.competition, 'Baseball')
  assert.equal(result.occasion, '')
  assert.equal(result.classification, '')
  assert.equal(result.date, '')
  assert.equal(result.leagueMark, null)
  assert.equal(heritagePassModel({ ...regular, sportId: null, gameType: 'W', seriesDescription: '' }).occasion, 'Postseason')
  const post = heritagePassModel({ ...regular, gameType: 'D', gameNumber: 2, seriesDescription: '', seriesGameNumber: null })
  assert.equal(post.seriesGame, null)
  assert.equal(post.occasion, 'DS')
})

test('minor-league championship uses the existing minor-league round vocabulary', () => {
  const result = heritagePassModel({ ...fixtures[2].game, gameType: 'W', seriesDescription: '', seriesGameNumber: null })
  assert.equal(result.competition, 'Minor League Baseball')
  assert.equal(result.occasion, 'CS')
})

test('the component model refuses live games, missing or invalid runs; keeps zero and unusual scores', () => {
  for (const status of ['Live', 'Preview', '', null]) {
    assert.equal(heritagePassModel({ ...regular, status }), null)
  }
  for (const runs of [null, undefined, NaN, Infinity, '2', -1, 1.5]) {
    assert.equal(heritagePassModel({ ...regular, away: { ...regular.away, runs } }), null)
    assert.equal(heritagePassModel({ ...regular, home: { ...regular.home, runs } }), null)
  }
  for (const runs of [0, 29, 49]) {
    assert.ok(heritagePassModel({ ...regular, away: { ...regular.away, runs } }))
  }
  assert.equal(heritagePassModel(null), null)
})

test('dates are formatted without timezone shifts and invalid dates are omitted', () => {
  assert.equal(passDate('2026-07-07'), 'Jul 7, 2026')
  for (const value of ['', null, '2026-02-30', '2026-99-02', '2026-7-7', 'garbage']) {
    assert.equal(passDate(value), '')
  }
})

test('tall-pass pagination retains every record and clamps after collection changes', () => {
  const stamps = Array.from({ length: 11 }, (_, gamePk) => ({ gamePk, placement: { page: 8 } }))
  const before = JSON.stringify(stamps)
  const pages = [1, 2, 3].map((page) => passPage(stamps, page))
  assert.equal(pages[0].entries.length, 4)
  assert.equal(pages[2].entries.length, 3)
  assert.deepEqual(pages.flatMap((p) => p.entries), stamps)
  assert.equal(passPage(stamps.slice(0, 2), 3).current, 1)
  assert.equal(passPage([], 8).pages, 1)
  assert.equal(passPage(stamps, -4).current, 1)
  assert.equal(JSON.stringify(stamps), before)
})

test('facts producers preserve absent metadata instead of asserting MLB regular season', () => {
  const schedule = stampGameFacts({ gamePk: 1 })
  assert.equal(schedule.sportId, null)
  assert.equal(schedule.gameType, null)
  const feed = revealStampFacts({ gamePk: 1 })
  assert.equal(feed.sportId, null)
  assert.equal(feed.gameType, null)
})

test('schedule producer carries the real series game separately from the doubleheader game', () => {
  const source = JSON.parse(readFileSync(new URL('./fixtures/world-series/schedule-2022.json', import.meta.url)))
  const game = source.dates[0].games[0]
  const facts = stampGameFacts(game)
  assert.equal(facts.seriesDescription, 'World Series')
  assert.equal(facts.seriesGameNumber, game.seriesGameNumber)
  assert.equal(facts.away.runs, 6)
  assert.equal(facts.home.runs, 5)
})

test('development preview has its own parsed route', () => {
  assert.equal(parseRoute('/heritage-pass-preview').name, 'heritage-pass-preview')
})

const primarySvg = '<svg viewBox="0 0 20 20"><path fill="#123456" d="M0 0L20 0L10 20Z"/></svg>'
const secondarySvg = '<svg viewBox="0 0 20 20"><path fill="#123456" d="M0 0L20 20L0 20Z"/></svg>'

test('secondary marks skip duplicate primary art and convert a genuinely distinct variant', async () => {
  const requested = []
  const svg = await secondaryLogoSvg(158, 'base', async (url) => {
    requested.push(url)
    return url === logoCdnUrl(158, 'cap') ? secondarySvg : primarySvg
  })
  assert.deepEqual(requested, [logoCdnUrl(158), logoCdnUrl(158, 'primary'), logoCdnUrl(158, 'cap')])
  assert.ok(svg.includes('heritage-secondary-158-cap'))
  assert.ok(svg.includes('M0 0L20 20L0 20Z'))
})

test('unavailable or repeated secondary marks leave the engraved fallback available', async () => {
  assert.equal(await secondaryLogoSvg(158, 'base', async () => { throw new Error('offline') }), null)
  assert.equal(await secondaryLogoSvg(158, 'base', async () => primarySvg), null)
  const svg = await secondaryLogoSvg(158, 'base', async (url) => {
    if (url === logoCdnUrl(158, 'primary')) throw new Error('404')
    return url === logoCdnUrl(158, 'cap') ? secondarySvg : primarySvg
  })
  assert.ok(svg.includes('heritage-secondary-158-cap'))
})

test('stadium artwork resolves by park key and every mapped file ships', () => {
  assert.equal(heritageArt('American Family Field').src, '/heritage-art/americanfamilyfield.webp')
  // Pre-2021 Brewers games have their own Miller Park engraving.
  assert.equal(heritageArt('Miller Park')?.src, '/heritage-art/millerpark.webp')
  assert.equal(heritageArt('Busch Stadium'), null)
  // Complete drawings share the default bottom alignment, without crop anchors.
  assert.equal(heritageArt('Comerica Park').position, undefined)
  assert.equal(heritageArt('American Family Field').position, undefined)
  assert.equal(heritageArt(''), null)
  // Houston's park keeps its art under its old sponsor's games.
  assert.equal(heritageArt('Minute Maid Park', 2392)?.src, '/heritage-art/daikinpark.webp')
  for (const venue of ['Fenway Park', 'Tropicana Field', 'Wrigley Field', 'Yankee Stadium', 'American Family Field',
    'Chase Field', 'Citi Field', 'Comerica Park', 'Coors Field', 'Daikin Park', 'Dodger Stadium', 'Globe Life Field',
    'Nationals Park', 'Oracle Park', 'Sutter Health Park', 'Target Field', 'T-Mobile Park', 'Truist Park',
    'Erlanger Park', 'Great American Ball Park', 'Keesler Federal Park', 'Miller Park', 'Turner Field']) {
    assert.ok(existsSync(new URL(`../public${heritageArt(venue).src}`, import.meta.url)), venue)
  }
})

test('the city line prefers the franchise name over the feed location', () => {
  assert.equal(passCity({ name: 'New York Mets', teamName: 'Mets', locationName: 'Flushing', franchiseName: 'New York' }), 'New York')
  // Facts saved before franchiseName was kept: the club name still carries the city.
  assert.equal(passCity({ name: 'New York Mets', teamName: 'Mets', locationName: 'Flushing' }), 'New York')
  assert.equal(passCity({ name: 'Athletics', teamName: 'Athletics', locationName: 'Sacramento', franchiseName: 'Athletics' }), 'Sacramento')
  assert.equal(passCity({ name: 'Arizona Diamondbacks', teamName: 'D-backs', locationName: 'Phoenix', franchiseName: 'Arizona' }), 'Arizona')
  assert.equal(passCity({ name: 'Somewhere', teamName: '' }), '')
})

test('a regular-season pass numbers the favorite club\'s season game, else the home club\'s', () => {
  const game = { ...regular, away: { ...regular.away, record: { wins: 42, losses: 59, ties: 0 } }, home: { ...regular.home, record: { wins: 63, losses: 37, ties: 0 } } }
  assert.equal(heritagePassModel(game, regular.away.id).seasonGame, 101)
  assert.equal(heritagePassModel(game, regular.home.id).seasonGame, 100)
  assert.equal(heritagePassModel(game, null).seasonGame, 100)
  assert.equal(heritagePassModel({ ...game, home: { ...game.home, record: null } }, null).seasonGame, null)
  assert.equal(heritagePassModel({ ...game, gameType: 'W' }, null).seasonGame, null)
})

test('the record after the game comes from the feed record, this game included', () => {
  assert.deepEqual(recordAfterGame({ wins: 63, losses: 37, ties: 0 }), { wins: 63, losses: 37, ties: 0 })
  assert.equal(recordAfterGame(undefined), null)
  assert.equal(recordAfterGame({ wins: 0, losses: 0 }), null)
})

// Phillies 2022, trimmed from /schedule?teamId=143&season=2022&gameType=R,F,D,L,W:
// their last regular-season game, two Wild Card wins, a postponed row and World Series Games 1-2.
const row = (gamePk, gameType, away, home, winner, state = 'Final') => ({
  gamePk, gameType, status: { abstractGameState: state === 'In Progress' ? 'Live' : 'Final', detailedState: state },
  teams: {
    away: { team: { id: away.id }, leagueRecord: away.record, isWinner: winner === away.id },
    home: { team: { id: home.id }, leagueRecord: home.record, isWinner: winner === home.id },
  },
})
const phi2022 = [
  row(663127, 'R', { id: 143, record: { wins: 87, losses: 75, ties: 0 } }, { id: 144, record: { wins: 101, losses: 61, ties: 0 } }, 144),
  row(715764, 'F', { id: 143, record: { wins: 1, losses: 0 } }, { id: 138, record: { wins: 0, losses: 1 } }, 143),
  row(715763, 'F', { id: 138, record: { wins: 0, losses: 2 } }, { id: 143, record: { wins: 2, losses: 0 } }, 143),
  row(715760, 'W', { id: 143, record: { wins: 0, losses: 0 } }, { id: 117, record: { wins: 0, losses: 0 } }, null, 'Postponed'),
  row(715724, 'W', { id: 143, record: { wins: 1, losses: 0 } }, { id: 117, record: { wins: 0, losses: 1 } }, 143),
  row(715723, 'W', { id: 143, record: { wins: 1, losses: 1 } }, { id: 117, record: { wins: 1, losses: 1 } }, 117),
]

test('a postseason record adds the year\'s postseason games to the final regular season', () => {
  assert.deepEqual(yearRecordThrough(phi2022, 143, 715724), { wins: 90, losses: 75 })
  assert.deepEqual(yearRecordThrough(phi2022, 143, 715723), { wins: 90, losses: 76 })
  assert.deepEqual(yearRecordThrough(phi2022, 143, 663127), { wins: 87, losses: 75 })
  assert.equal(yearRecordThrough(phi2022, 143, 999), null)
  assert.equal(yearRecordThrough([], 143, 715724), null)
})

test('a postponed game counts once, on the row it was played', () => {
  // The rained-out row and the played row share one gamePk (#1342).
  const rainedOut = { ...phi2022[4], status: { abstractGameState: 'Final', detailedState: 'Postponed' } }
  const rows = [...phi2022.slice(0, 4), rainedOut, ...phi2022.slice(4)]
  assert.deepEqual(yearRecordThrough(rows, 143, 715724), { wins: 90, losses: 75 })
})

test('a game just ended or called early counts toward the record', () => {
  const rows = phi2022.map((r) => (r.gamePk === 715724 ? { ...r, status: { abstractGameState: 'Final', detailedState: 'Game Over' } }
    : r.gamePk === 715763 ? { ...r, status: { abstractGameState: 'Final', detailedState: 'Completed Early: Rain' } } : r))
  assert.deepEqual(yearRecordThrough(rows, 143, 715724), { wins: 90, losses: 75 })
})

test('a pass reads regular-season records from its own facts', () => {
  const game = { ...regular, away: { ...regular.away, record: { wins: 42, losses: 59, ties: 0 } }, home: { ...regular.home, record: null } }
  assert.deepEqual(factsRecord(game, 'away'), { wins: 42, losses: 59 })
  assert.equal(factsRecord(game, 'home'), null)
  assert.equal(factsRecord({ ...game, gameType: 'W' }, 'away'), null)
  assert.equal(passRecordText({ wins: 90, losses: 75 }), '90–75')
  assert.equal(passRecordText(null), '')
})

test('a dark badge field is knocked out so its art reads on the navy band', () => {
  const badge = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z" fill="#12284b"/><path d="M2 2h6v6H2z" fill="#ffc52f"/><path d="M4 4h2v2H4z" fill="#fff"/></svg>'
  assert.deepEqual(badgeFieldPins(badge), { 0: 'knockout', 1: 'ink', 2: 'ink' })
  const wordmark = '<svg viewBox="0 0 10 10"><path d="M0 0h4v4H0z" fill="#12284b"/><path d="M5 5h4v4H5z" fill="#ffc52f"/></svg>'
  assert.equal(badgeFieldPins(wordmark), null)
})
