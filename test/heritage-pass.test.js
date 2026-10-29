import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { heritagePassModel, passDate, passPage } from '../src/lib/heritage/pass.js'
import { stampGameFacts } from '../src/api/logbook.js'
import { revealStampFacts } from '../src/api/linescore.js'
import { parseRoute } from '../src/lib/route.js'
import { secondaryLogoSvg } from '../src/lib/heritage/marks.js'
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
  assert.equal(heritageArt('Busch Stadium'), null)
  assert.equal(heritageArt(''), null)
  for (const venue of ['Fenway Park', 'Tropicana Field', 'Wrigley Field', 'Yankee Stadium', 'American Family Field']) {
    assert.ok(existsSync(new URL(`../public${heritageArt(venue).src}`, import.meta.url)), venue)
  }
})
