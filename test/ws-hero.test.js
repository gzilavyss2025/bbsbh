// The World Series hero's pure parts: the calendar's day cells, the player on
// each club's slab, and the clip behind a slab's play button.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRE_SERIES_PICKS, calendarDays, monthsOf, nextGamePath, slabPlayers, spotlightAt, spotlightCount, spotlightRoster, storedClip, withFormatDates } from '../src/lib/postseason/worldseries/hero.js'
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
  assert.equal(withFormatDates([], [{ gameNumber: 6, date: null, ifNecessary: true }])[0].date, null)
})

test('only an if-needed game is dated from the format, and never on or before the slate date', () => {
  // Game 3 is not if-needed but its row is missing (bracket.js hides it): it stays undated.
  const played = [{ gameNumber: 2, date: '2026-10-24' }]
  const g3 = withFormatDates(played, [{ gameNumber: 3, date: null, ifNecessary: false }], '2026-10-26')
  assert.equal(g3[0].date, null)
  // An if-needed Game 5 the format would put on the slate date (Game 4 two days ago) stays
  // undated, and so does the chain after it: a projection is never today or in the past.
  const late = withFormatDates([{ gameNumber: 4, date: '2026-10-27' }], HIDDEN.slice(4), '2026-10-28')
  assert.deepEqual(late.map((g) => g.date), [null, null, null])
})

test('with format dates the calendar has every game dated and the off day before Game 6', () => {
  const columns = ledgerModel({ clubIds: [139, 158], games: [], upcoming: withFormatDates([], HIDDEN), slateDate: '2026-10-20' }).columns
  const days = calendarDays(columns, '2026-10-20')
  assert.deepEqual(days.map((d) => d.day), [20, 23, 24, 25, 26, 27, 28, 29, 30, 31])
  assert.deepEqual(days.filter((d) => d.kind === 'off').map((d) => d.date), ['2026-10-25', '2026-10-29'])
})

// The first hitter on a club's slab, or null.
const slabPlayer = (splits, opts) => slabPlayers(splits, opts, 1)[0] ?? null
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

test('a pre-Series pick reads its current name and figures from the split row', () => {
  const refreshed = RAYS.map((s) => (s.player.id === 650490 ? split(650490, 'Yandy Díaz Hernández', 46, '.940', '1B') : s))
  const player = slabPlayer(refreshed, { clubId: 139, season: 2026, started: false })
  assert.equal(player.id, 650490)
  assert.equal(player.name, 'Yandy Díaz Hernández')
  assert.equal(player.pos, '1B')
  assert.equal(player.pa, 46)
  assert.equal(player.ops, '.940')
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

test('incomplete splits cannot hold a pre-Series pick or replace a player with a missing identity', () => {
  const incomplete = [
    { player: { id: 641343, fullName: 'Jake Bauers' } },
    { player: { fullName: 'Missing identity' }, stat: { plateAppearances: 60, ops: '2.000' } },
    split(661388, 'William Contreras', 35, '1.157', 'C'),
  ]
  assert.equal(slabPlayer(incomplete, { clubId: 158, season: 2026, started: false })?.id, 661388)
  assert.equal(slabPlayer(incomplete.slice(0, 2), { clubId: 158, season: 2026, started: false }), null)
})

test('an OPS tie goes to the hitter with more PA, and "-.--" never qualifies', () => {
  const tie = [split(1, 'A', 30, '.900'), split(2, 'B', 40, '.900'), split(3, 'C', 50, '-.--')]
  assert.equal(slabPlayer(tie, { clubId: 999, season: 2026, started: true })?.name, 'B')
})

// A stored highlight row (public/data/highlights/{teamId}.json): the generator already filtered it.
const clip = (clipId, playerId, category = 'hitting') => ({ clipId, playerId, category, title: clipId })
const file = (...games) => ({ games: games.map(([gamePk, date, ...clips]) => ({ gamePk, date, clips })) })
const post = new Set([1, 2, 3, 4])
const NOW = { slateDate: '2026-10-23', gamePks: post }
const hitter = (id) => ({ id, kind: 'hitter' })
const pitcher = (id) => ({ id, kind: 'pitcher' })

test('a new OPS leader changes the featured identity and the highlight attached to it', () => {
  const options = { clubId: 158, season: 2026, started: true }
  const files = [file([1, '2026-10-22', clip('contreras-double', 661388), clip('bauers-homer', 641343)])]
  const before = slabPlayer(BREWERS, options)
  assert.equal(before.id, 661388)
  assert.equal(storedClip(files, before, NOW)?.clipId, 'contreras-double')

  const updated = BREWERS.map((s) => (s.player.id === 641343 ? split(641343, 'Jake Bauers', 39, '1.200', '1B') : s))
  const after = slabPlayer(updated, options)
  assert.equal(after.id, 641343)
  assert.equal(after.name, 'Jake Bauers')
  assert.equal(after.ops, '1.200')
  assert.equal(storedClip(files, after, NOW)?.clipId, 'bauers-homer')
  assert.equal(storedClip([], after, NOW), null)
})

test('the play button gets the player\'s clip from the newest game that has one', () => {
  const files = [
    file([1, '2026-10-14', clip('old-homer', 650490)], [2, '2026-10-17', clip('recap', null), clip('new-double', 650490), clip('other', 691406)]),
    file([3, '2026-10-16', clip('mid', 650490)]),
  ]
  assert.equal(storedClip(files, hitter(650490), NOW)?.clipId, 'new-double')
  assert.equal(storedClip(files, hitter(691406), NOW)?.clipId, 'other')
  // The clip carries its game, for the sheet and the caption.
  assert.deepEqual([storedClip(files, hitter(650490), NOW).gamePk, storedClip(files, hitter(650490), NOW).date], [2, '2026-10-17'])
})

test('a Series postseason clip wins; with none, the newest from earlier in the season', () => {
  const files = [file([9, '2026-10-20', clip('regular-season', 650490)], [4, '2026-10-22', clip('ccs', 650490)], [8, '2026-10-21', clip('later-regular', 650490)])]
  assert.equal(storedClip(files, hitter(650490), NOW)?.clipId, 'ccs')
  // A newer non-Series clip does not beat a Series one.
  assert.equal(storedClip([file([9, '2026-10-22', clip('regular-season', 650490)], [4, '2026-10-12', clip('ccs', 650490)])], hitter(650490), NOW)?.clipId, 'ccs')
  // A player with no Series clip gets his newest season one.
  assert.equal(storedClip([file([9, '2026-09-01', clip('sept', 7)], [8, '2026-09-20', clip('later-sept', 7)])], hitter(7), NOW)?.clipId, 'later-sept')
  // The Series games are not known yet: the newest season clip stands in.
  assert.equal(storedClip(files, hitter(650490), { slateDate: '2026-10-23', gamePks: new Set() })?.clipId, 'ccs')
})

test('a clip dated on or after the slate date is never used', () => {
  const files = [file([4, '2026-10-22', clip('yesterday', 650490)], [3, '2026-10-23', clip('today', 650490)], [5, '2026-10-24', clip('tomorrow', 650490)])]
  assert.equal(storedClip(files, hitter(650490), NOW)?.clipId, 'yesterday')
  assert.equal(storedClip(files, hitter(650490), { slateDate: '2026-10-22', gamePks: post }), null)
})

test('a hitter gets a hitting clip and a pitcher a pitching one', () => {
  const files = [file([1, '2026-10-17', clip('k-of-diaz', 650490, 'pitching'), clip('diaz-double', 650490)], [2, '2026-10-18', clip('save', 100, 'pitching'), clip('bat', 100)])]
  assert.equal(storedClip(files, hitter(650490), NOW)?.clipId, 'diaz-double')
  assert.equal(storedClip([file([1, '2026-10-17', clip('k-of-diaz', 650490, 'pitching')])], hitter(650490), NOW), null)
  assert.equal(storedClip(files, pitcher(100), NOW)?.clipId, 'save')
  assert.equal(storedClip([file([1, '2026-10-17', clip('bat', 100)])], pitcher(100), NOW), null)
})

test('no clip, no player, or no files gives no button', () => {
  assert.equal(storedClip([file([1, '2026-10-17', clip('other', 7)])], hitter(650490), NOW), null)
  assert.equal(storedClip([], hitter(650490), NOW), null)
  assert.equal(storedClip(undefined, hitter(650490), NOW), null)
  assert.equal(storedClip([file([1, '2026-10-17', clip('x', 650490)])], null, NOW), null)
})

test('the next-game door is dated by the game, not by the slate date', () => {
  const abbr = { 139: 'TB', 158: 'MIL' }
  const game = { awayId: 139, homeId: 158, date: '2026-10-23' }
  // An off day: Game 1 is days away, so the preview lives on Game 1's own date.
  assert.equal(nextGamePath(game, '2026-10-21', abbr, 'preview'), '/10232026/tbmil/preview')
  // A game day: the game's date is the slate date.
  assert.equal(nextGamePath({ ...game, date: '2026-10-21' }, '2026-10-21', abbr, 'lineup1'), '/10212026/tbmil/lineup1')
  // A row with no date falls back to the slate date; no game, no path.
  assert.equal(nextGamePath({ awayId: 139, homeId: 158 }, '2026-10-21', abbr, 'preview'), '/10212026/tbmil/preview')
  assert.equal(nextGamePath(null, '2026-10-21', abbr, 'preview'), null)
})

test('monthsOf: the calendar head names each month once, in order, and skips undated cells', () => {
  const days = [{ date: '2026-10-30' }, { date: '2026-10-31' }, { date: null }, { date: '2026-11-01' }]
  assert.equal(monthsOf(days), 'October / November')
  assert.equal(monthsOf([{ date: '2026-10-24' }]), 'October')
  assert.equal(monthsOf([]), '')
})

test('the slab list starts with the pre-Series pick, then the OPS regulars, then the rest by PA', () => {
  const rows = [split(1, 'Few', 9, '1.500'), split(2, 'Low', 40, '.700'), split(3, 'High', 30, '.950'), split(4, 'Mid', 60, '.800'), split(5, 'Pick', 12, '.500')]
  const lists = (started) => slabPlayers(rows, { clubId: 7, season: 2026, started }).map((r) => r.name)
  assert.deepEqual(lists(true), ['High', 'Mid', 'Low', 'Pick'])
  PRE_SERIES_PICKS[2026][7] = 5
  try {
    assert.deepEqual(lists(false), ['Pick', 'High', 'Mid', 'Low'])
    assert.deepEqual(lists(true), ['High', 'Mid', 'Low', 'Pick'])
  } finally {
    delete PRE_SERIES_PICKS[2026][7]
  }
})

test('the slab list is capped, holds nobody twice, and matches slabPlayer at its head', () => {
  assert.equal(slabPlayers(BREWERS, { clubId: 158, season: 2026, started: false }, 2).length, 2)
  for (const [splits, clubId] of [[RAYS, 139], [BREWERS, 158]]) {
    const list = slabPlayers(splits, { clubId, season: 2026, started: false })
    assert.ok(list.length <= 4)
    assert.equal(new Set(list.map((r) => r.id)).size, list.length)
    assert.deepEqual(list[0], slabPlayer(splits, { clubId, season: 2026, started: false }))
  }
  assert.deepEqual(slabPlayers(undefined, { clubId: 1, season: 2026, started: true }), [])
})

test('a tap steps both clubs, and a shorter list wraps on its own', () => {
  const lists = [[{ id: 1 }, { id: 2 }, { id: 3 }], [{ id: 10 }]]
  assert.equal(spotlightCount(lists), 3)
  assert.deepEqual(spotlightAt(lists, 0).map((p) => p.id), [1, 10])
  assert.deepEqual(spotlightAt(lists, 2).map((p) => p.id), [3, 10])
  assert.deepEqual(spotlightAt([[], [{ id: 10 }]], 1), [null, { id: 10 }])
  assert.equal(spotlightCount([[], []]), 0)
})

// A club's roster: two hitters with October lines, a bench bat and a reliever with none, and a
// starter with one.
const person = (id, name, position, jersey) => ({ id, name, position, jersey })
const POOL = {
  roster: {
    positionPlayers: [person(1, 'Top Bat', 'RF', '10'), person(2, 'Few PA', '1B', '11'), person(3, 'Bench Bat', 'C', '12'), person(4, 'Rookie', 'SS', '13')],
    pitchers: [person(5, 'Starter', 'P', '20'), person(6, 'Closer', 'P', '21'), person(7, 'Mop Up', 'P', '22')],
  },
  hitP: [split(1, 'Top Bat', 30, '.950'), split(2, 'Few PA', 8, '1.500')],
  hitR: [split(3, 'Bench Bat', 300, '.700')],
  pitP: [{ player: { id: 5 }, stat: { inningsPitched: '12.1', era: '2.19' } }],
  pitR: [{ player: { id: 6 }, stat: { inningsPitched: '60.0', era: '2.85' } }],
}

test('the whole roster is walked: hitters, then pitchers, then those with no October line', () => {
  const list = spotlightRoster(POOL, { clubId: 7, season: 2026, started: true })
  // Top Bat is the only regular; Few PA has a line but under MIN_PA; Starter is the one pitcher with October innings;
  // then the rest of the hitters by regular-season PA (the rookie, with none, last), then the rest of the pitchers by
  // regular-season innings (the mop-up man, with none, last).
  assert.deepEqual(list.map((p) => p.name), ['Top Bat', 'Few PA', 'Starter', 'Bench Bat', 'Rookie', 'Closer', 'Mop Up'])
  assert.deepEqual(list.map((p) => p.kind), ['hitter', 'hitter', 'pitcher', 'hitter', 'hitter', 'pitcher', 'pitcher'])
})

test('each player gets his October line, else his season line marked, else "No stats yet"', () => {
  const figs = Object.fromEntries(spotlightRoster(POOL, { clubId: 7, season: 2026, started: true }).map((p) => [p.name, p.figs]))
  assert.equal(figs['Top Bat'], '.950 OPS · 30 PA')
  assert.equal(figs.Starter, '2.19 ERA · 12.1 IP')
  assert.equal(figs['Bench Bat'], '.700 OPS · 300 PA · Season')
  assert.equal(figs.Closer, '2.85 ERA · 60.0 IP · Season')
  assert.equal(figs.Rookie, 'No stats yet')
})

test('the pre-Series pick leads until a game is played, and a long roster is cut at 26', () => {
  PRE_SERIES_PICKS[2026][7] = 3
  try {
    assert.equal(spotlightRoster(POOL, { clubId: 7, season: 2026, started: false })[0].name, 'Bench Bat')
    assert.equal(spotlightRoster(POOL, { clubId: 7, season: 2026, started: true })[0].name, 'Top Bat')
  } finally {
    delete PRE_SERIES_PICKS[2026][7]
  }
  const big = { roster: { positionPlayers: Array.from({ length: 40 }, (_, i) => person(100 + i, `P${i}`, 'LF', String(i))), pitchers: [] } }
  assert.equal(spotlightRoster(big, { clubId: 7, season: 2026, started: true }).length, 26)
})

test('without a roster there is no list, and a split with no PA or innings is left out', () => {
  assert.deepEqual(spotlightRoster({ roster: null }, { clubId: 7, season: 2026, started: true }), [])
  assert.deepEqual(spotlightRoster(undefined, { clubId: 7, season: 2026, started: true }), [])
  const idle = { roster: POOL.roster, hitP: [split(4, 'Rookie', 0, '.000')], pitP: [{ player: { id: 7 }, stat: { inningsPitched: '0.0', era: '-.--' } }] }
  const figs = Object.fromEntries(spotlightRoster(idle, { clubId: 7, season: 2026, started: true }).map((p) => [p.name, p.figs]))
  assert.equal(figs.Rookie, 'No stats yet')
  assert.equal(figs['Mop Up'], 'No stats yet')
})

test('the hot-bat list that shows before the roster loads is the front of the roster list', () => {
  // So the pool landing does not change the pair on screen: both orders agree on the hitters they share.
  const roster = { positionPlayers: [...RAYS, ...BREWERS].map((s) => person(s.player.id, s.player.fullName, 'RF', '1')), pitchers: [] }
  for (const [splits, clubId] of [[RAYS, 139], [BREWERS, 158]]) {
    const options = { clubId, season: 2026, started: false }
    const early = slabPlayers(splits, options).map((p) => p.id)
    const full = spotlightRoster({ roster, hitP: splits }, options).map((p) => p.id)
    assert.deepEqual(full.slice(0, early.length), early)
  }
})

test('a two-way player is a hitter, unless only his pitching has a line', () => {
  const roster = { positionPlayers: [person(9, 'Two Way', 'TWP', '17'), person(8, 'Both Ways', 'TWP', '18')], pitchers: [] }
  const pool = {
    roster,
    hitP: [split(8, 'Both Ways', 30, '.800')],
    pitP: [{ player: { id: 9 }, stat: { inningsPitched: '6.0', era: '1.50' } }, { player: { id: 8 }, stat: { inningsPitched: '2.0', era: '0.00' } }],
  }
  const list = spotlightRoster(pool, { clubId: 7, season: 2026, started: true })
  const by = Object.fromEntries(list.map((p) => [p.name, p]))
  assert.deepEqual([by['Both Ways'].kind, by['Both Ways'].figs], ['hitter', '.800 OPS · 30 PA'])
  assert.deepEqual([by['Two Way'].kind, by['Two Way'].figs], ['pitcher', '1.50 ERA · 6.0 IP'])
})
