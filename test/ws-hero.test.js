// The World Series hero's pure parts: the calendar's day cells, the player on
// each club's slab, and the clip behind a slab's play button.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDays, clipSources, playerClip, slabPlayer, withFormatDates } from '../src/lib/postseason/worldseries/hero.js'
import { ledgerModel } from '../src/lib/postseason/worldseries/ledger.js'

// The 2026 Series as the bracket gives it before Game 1: seven dated games, three if needed.
const UPCOMING = [
  ['2026-10-23', 1], ['2026-10-24', 2], ['2026-10-26', 3], ['2026-10-27', 4],
  ['2026-10-28', 5, true], ['2026-10-30', 6, true], ['2026-10-31', 7, true],
].map(([date, gameNumber, ifNecessary = false]) => ({ gamePk: 849800 + gameNumber, gameNumber, date, ifNecessary }))

const columnsOn = (slateDate, games = []) =>
  ledgerModel({ clubIds: [139, 158], games, upcoming: UPCOMING, slateDate }).columns

const brief = (days) => days.map((d) => [d.date, d.gameNumber, d.today, d.next, d.maybe])

test('before Game 1, today gets a cell of its own ahead of the games, and Game 1 is next', () => {
  const days = calendarDays(columnsOn('2026-10-20'), '2026-10-20')
  assert.deepEqual(brief(days).slice(0, 3), [
    ['2026-10-20', null, true, false, false],
    ['2026-10-23', 1, false, true, false],
    ['2026-10-24', 2, false, false, false],
  ])
  // One cell per game, one per off day, plus today: 7 + 2 + 1.
  assert.equal(days.length, 10)
  assert.deepEqual(days.map((d) => d.weekday), ['Tue', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  assert.deepEqual(days.map((d) => d.day), [20, 23, 24, 25, 26, 27, 28, 29, 30, 31])
})

test('an off day is dated the day after the game before it, and an if-needed game is marked', () => {
  const days = calendarDays(columnsOn('2026-10-20'), '2026-10-20')
  const offs = days.filter((d) => d.kind === 'off')
  assert.deepEqual(offs.map((d) => d.date), ['2026-10-25', '2026-10-29'])
  assert.deepEqual(days.filter((d) => d.maybe).map((d) => d.gameNumber), [5, 6, 7])
})

test('on an off day inside the Series, the off cell is today and no extra cell is added', () => {
  const played = [{ gamePk: 849801, gameNumber: 1, date: '2026-10-23' }, { gamePk: 849802, gameNumber: 2, date: '2026-10-24' }]
  const days = calendarDays(columnsOn('2026-10-25', played), '2026-10-25')
  assert.equal(days.length, 9)
  const today = days.filter((d) => d.today)
  assert.deepEqual(today.map((d) => [d.kind, d.date]), [['off', '2026-10-25']])
  assert.equal(days.find((d) => d.next)?.gameNumber, 3)
})

test('on a game day, that game is today and the next one is inked', () => {
  const played = [{ gamePk: 849801, gameNumber: 1, date: '2026-10-23' }]
  const days = calendarDays(columnsOn('2026-10-24', played), '2026-10-24')
  assert.deepEqual(days.filter((d) => d.today).map((d) => d.gameNumber), [2])
  assert.equal(days.find((d) => d.next)?.gameNumber, 3)
  assert.equal(days.length, 9)
})

test('a game with no date keeps its cell, with no weekday or day', () => {
  const cols = [{ kind: 'game', gameNumber: 1, date: null, state: 'future', ifNecessary: false }]
  const [today, g1] = calendarDays(cols, '2026-10-20')
  assert.equal(today.today, true)
  assert.deepEqual([g1.gameNumber, g1.weekday, g1.day, g1.next], [1, '', null, true])
})

// bracket.js hides an if-needed game's date (the live schedule keeping or dropping it can tell
// how the Series ended), so the hero dates it from the 2-3-2 format instead.
const HIDDEN = UPCOMING.map((g) => (g.ifNecessary ? { ...g, gamePk: null, date: null } : g))

test('an if-needed game with no date gets the format\'s date: the next day, two days after Games 2 and 5', () => {
  const dated = withFormatDates([], HIDDEN)
  assert.deepEqual(dated.map((g) => g.date), UPCOMING.map((g) => g.date))
  assert.deepEqual(dated.filter((g) => g.projected).map((g) => g.gameNumber), [5, 6, 7])
  // A real date is never replaced, and a played game's date carries the chain.
  const played = [{ gameNumber: 4, date: '2026-10-27' }]
  assert.deepEqual(withFormatDates(played, HIDDEN.slice(4)).map((g) => g.date), ['2026-10-28', '2026-10-30', '2026-10-31'])
  // With no date before it, a game stays undated.
  assert.equal(withFormatDates([], [{ gameNumber: 6, date: null }])[0].date, null)
})

test('with format dates the calendar has every game dated and the off day before Game 6', () => {
  const columns = ledgerModel({ clubIds: [139, 158], games: [], upcoming: withFormatDates([], HIDDEN), slateDate: '2026-10-20' }).columns
  const days = calendarDays(columns, '2026-10-20')
  assert.deepEqual(days.map((d) => d.day), [20, 23, 24, 25, 26, 27, 28, 29, 30, 31])
  assert.deepEqual(days.filter((d) => d.kind === 'off').map((d) => d.date), ['2026-10-25', '2026-10-29'])
})

const split = (id, name, pa, ops, pos = 'RF') => ({ player: { id, fullName: name }, position: { abbreviation: pos }, stat: { plateAppearances: pa, ops } })
const RAYS = [
  split(650490, 'Yandy Díaz', 41, '.905', 'DH'),
  split(666018, 'Jonathan Aranda', 40, '.676', '1B'),
  split(691406, 'Junior Caminero', 37, '.806', '3B'),
  split(668723, 'Ryan Vilade', 7, '1.229'),
]
const BREWERS = [
  split(694192, 'Jackson Chourio', 38, '.554', 'CF'),
  split(661388, 'William Contreras', 35, '1.157', 'C'),
  split(641343, 'Jake Bauers', 34, '.864', '1B'),
]

test('before the Series starts, the slab shows the chosen player for each club', () => {
  assert.equal(slabPlayer(RAYS, { clubId: 139, season: 2026, started: false })?.name, 'Yandy Díaz')
  const bauers = slabPlayer(BREWERS, { clubId: 158, season: 2026, started: false })
  assert.deepEqual([bauers.id, bauers.pos, bauers.pa, bauers.ops], [641343, '1B', 34, '.864'])
})

test('once a Series game is played, the slab shows the best OPS among hitters with 25 or more PA', () => {
  assert.equal(slabPlayer(RAYS, { clubId: 139, season: 2026, started: true })?.name, 'Yandy Díaz')
  assert.equal(slabPlayer(BREWERS, { clubId: 158, season: 2026, started: true })?.name, 'William Contreras')
})

test('a chosen player missing from the splits falls back to the OPS rule', () => {
  const noBauers = BREWERS.filter((s) => s.player.id !== 641343)
  assert.equal(slabPlayer(noBauers, { clubId: 158, season: 2026, started: false })?.name, 'William Contreras')
})

test('with nobody at 25 PA the most PA wins, and no splits means no player', () => {
  const thin = [split(1, 'A', 9, '.700'), split(2, 'B', 12, '.500'), split(3, 'C', 4, '2.000')]
  assert.equal(slabPlayer(thin, { clubId: 999, season: 2026, started: true })?.name, 'B')
  assert.equal(slabPlayer([], { clubId: 139, season: 2026, started: true }), null)
  assert.equal(slabPlayer(undefined, { clubId: 139, season: 2026, started: false }), null)
})

test('an OPS tie goes to the hitter with more PA, and "-.--" never qualifies', () => {
  const tie = [split(1, 'A', 30, '.900'), split(2, 'B', 40, '.900'), split(3, 'C', 50, '-.--')]
  assert.equal(slabPlayer(tie, { clubId: 999, season: 2026, started: true })?.name, 'B')
})

const clip = (id, playerId, taxonomy = ['highlight', 'hitting']) => ({
  id,
  keywordsAll: [
    ...(playerId ? [{ type: 'player_id', value: String(playerId) }] : []),
    ...taxonomy.map((value) => ({ type: 'taxonomy', value })),
  ],
})

test('the play button gets the player\'s clip from the newest game that has one', () => {
  const games = [
    { gamePk: 1, date: '2026-10-14', gameNumber: 3, clips: [clip('old-homer', 650490)] },
    { gamePk: 2, date: '2026-10-17', gameNumber: 6, clips: [clip('recap', null), clip('new-double', 650490), clip('other', 691406)] },
    { gamePk: 3, date: '2026-10-16', gameNumber: 5, clips: [clip('mid', 650490)] },
  ]
  assert.equal(playerClip(games, 650490)?.id, 'new-double')
  assert.equal(playerClip(games, 691406)?.id, 'other')
})

test('clips are read from each club\'s last three games before the slate date, a shared game once', () => {
  const row = (gamePk, date) => ({ gamePk, date, gameNumber: 1 })
  const clubGames = {
    139: [row(1, '2026-10-12'), row(2, '2026-10-14'), row(3, '2026-10-16'), row(4, '2026-10-17'), row(9, '2026-10-23')],
    158: [row(5, '2026-10-15'), row(4, '2026-10-17')],
  }
  const pks = clipSources(clubGames, [139, 158], '2026-10-20').map((g) => g.gamePk)
  // 139's last three before the 20th (2, 3, 4), then 158's (5; 4 already read). Game 9 is not past.
  assert.deepEqual(pks, [2, 3, 4, 5])
  assert.deepEqual(clipSources(undefined, [139], '2026-10-20'), [])
})

test('a clip that is not a play highlight, or no clip at all, gives no button', () => {
  const games = [{ gamePk: 1, date: '2026-10-17', gameNumber: 1, clips: [clip('interview', 650490, ['interview'])] }]
  assert.equal(playerClip(games, 650490), null)
  assert.equal(playerClip([], 650490), null)
  assert.equal(playerClip(games, null), null)
})
