import assert from 'node:assert/strict'
import test from 'node:test'
import {
  entryFlag,
  lastAppearanceCells,
  lastAppearanceHeading,
  pitchTiles,
  pitcherRole,
  restLabel,
  seasonCells,
  showCareerRow,
  showPostseasonRow,
  tileColumns,
} from '../src/lib/pitcherCard/card.js'
import { BAR_TOP, MOVE, SCENE_H, SCENE_W, arc, sceneFrame, scenePitches } from '../src/lib/pitcherCard/scene.js'

// The Now Pitching card's pure model (#1344). Expected values are the issue's
// reference table: the two Wild Card games, PHI @ ATL, 2026-09-29 and -30.

// ---- Role rule ---------------------------------------------------------------

test('starter: GS >= G / 2, with the edge GS = G / 2', () => {
  assert.equal(pitcherRole({ games: 25, gamesStarted: 23, saves: 0, holds: 0 }), 'starter') // Painter
  assert.equal(pitcherRole({ games: 10, gamesStarted: 5, saves: 9, holds: 0 }), 'starter')
  assert.equal(pitcherRole({ games: 11, gamesStarted: 5, saves: 9, holds: 0 }), 'closer')
})

test('closer: not a starter, and SV >= HLD, with the edge SV = HLD', () => {
  assert.equal(pitcherRole({ games: 61, gamesStarted: 0, saves: 33, holds: 2 }), 'closer') // Duran
  assert.equal(pitcherRole({ games: 30, gamesStarted: 0, saves: 4, holds: 4 }), 'closer')
  assert.equal(pitcherRole({ games: 30, gamesStarted: 0, saves: 4, holds: 5 }), 'setup')
})

test('setup: every other arm', () => {
  assert.equal(pitcherRole({ games: 71, gamesStarted: 0, saves: 0, holds: 31 }), 'setup') // Lee
  assert.equal(pitcherRole({ games: 58, gamesStarted: 0, saves: 3, holds: 18 }), 'setup') // Fuentes
})

test('no line, no role', () => {
  assert.equal(pitcherRole(null), null)
  assert.equal(pitcherRole({ games: 0, gamesStarted: 0, saves: 0, holds: 0 }), null)
})

// ---- Season and postseason rows ------------------------------------------------

const MAHLE = {
  games: 27, gamesStarted: 27, wins: 7, losses: 10, saves: 0, holds: 0,
  era: '3.99', inningsPitched: '149.0', strikeOuts: 137, baseOnBalls: 46, whip: '1.23',
}
const LEE = {
  games: 71, gamesStarted: 0, wins: 6, losses: 2, saves: 0, holds: 31,
  era: '3.09', inningsPitched: '67.0', strikeOuts: 77, baseOnBalls: 17, whip: '0.97',
}
const LEE_POST = {
  games: 1, gamesStarted: 0, wins: 1, losses: 0, saves: 0, holds: 0,
  era: '0.00', inningsPitched: '1.0', strikeOuts: 1, baseOnBalls: 0, whip: '0.00',
}

test('starter columns: GS W-L ERA IP K BB WHIP', () => {
  const cells = seasonCells('starter', MAHLE)
  assert.deepEqual(cells.map((c) => c.label), ['GS', 'W-L', 'ERA', 'IP', 'K', 'BB', 'WHIP'])
  assert.deepEqual(cells.map((c) => c.value), ['27', '7-10', '3.99', '149.0', '137', '46', '1.23'])
})

test('closer and setup columns', () => {
  assert.deepEqual(seasonCells('closer', LEE).map((c) => c.label), ['G', 'SV', 'ERA', 'IP', 'K', 'BB', 'WHIP'])
  const setup = seasonCells('setup', LEE)
  assert.deepEqual(setup.map((c) => c.label), ['G', 'HLD', 'ERA', 'IP', 'K', 'BB', 'WHIP'])
  assert.deepEqual(setup.map((c) => c.value), ['71', '31', '3.09', '67.0', '77', '17', '0.97'])
})

// Lee won Gm 1. A decision in the postseason row says how an earlier game of
// the same series ended, so the column shows a dash, and no W anywhere.
test('the postseason row shows a dash in the decision column, whatever the role', () => {
  for (const role of ['starter', 'closer', 'setup']) {
    const cells = seasonCells(role, LEE_POST, { postseason: true })
    assert.equal(cells[1].value, '–', role)
    assert.equal(cells.length, 7)
  }
  assert.deepEqual(
    seasonCells('setup', LEE_POST, { postseason: true }).map((c) => c.value),
    ['1', '–', '0.00', '1.0', '1', '0', '0.00'],
  )
})

test('postseason row: hidden in the regular season', () => {
  assert.equal(showPostseasonRow('R', LEE_POST), false)
})

test('postseason row: hidden with no earlier postseason game', () => {
  assert.equal(showPostseasonRow('F', null), false)
  assert.equal(showPostseasonRow('F', { ...LEE_POST, games: 0 }), false)
})

test('postseason row: shown in a postseason game after one he pitched in', () => {
  for (const t of ['F', 'D', 'L', 'W']) assert.equal(showPostseasonRow(t, LEE_POST), true, t)
})

test('all-time row: only in a postseason game, only when it adds games', () => {
  const career = { ...LEE_POST, games: 5 }
  assert.equal(showCareerRow('R', career, LEE_POST), false)
  assert.equal(showCareerRow('F', null, LEE_POST), false)
  assert.equal(showCareerRow('F', LEE_POST, LEE_POST), false)
  assert.equal(showCareerRow('F', career, LEE_POST), true)
})

test('all-time row: shown for earlier Octobers and none this year', () => {
  assert.equal(showCareerRow('D', { ...LEE_POST, games: 3 }, null), true)
  assert.equal(showCareerRow('D', { ...LEE_POST, games: 3 }, { ...LEE_POST, games: 0 }), true)
})

// ---- Pitch tiles ---------------------------------------------------------------

// pitchArsenalFor's rows (most-thrown first), from the 2026 shards.
const row = (code, pitches, avgVelo) => ({ code, pitches, avgVelo })
const FUENTES = [row('FF', 845, 97.3), row('SL', 293, 85.4), row('FS', 83, 89), row('CU', 8, 79.8)]
const PAINTER = [
  row('FF', 697, 96.6), row('SL', 373, 88), row('ST', 354, 82.7), row('CH', 230, 90.5),
  row('SI', 182, 95.1), row('FS', 164, 87.4), row('CU', 126, 81.3),
]

test('percents add to 100 by largest remainder (Painter)', () => {
  const tiles = pitchTiles(PAINTER)
  assert.deepEqual(tiles.map((t) => t.pct), ['33', '17', '17', '11', '8', '8', '6'])
  assert.deepEqual(tiles.map((t) => t.mph), ['96.6', '88.0', '82.7', '90.5', '95.1', '87.4', '81.3'])
  assert.equal(tiles[0].family, 'fastball')
  assert.equal(tiles[2].family, 'breaking')
  assert.equal(tiles[3].family, 'offspeed')
})

test('a pitch under 3% folds into "Other", shown as "<1" when it rounds to 0 (Fuentes)', () => {
  const tiles = pitchTiles(FUENTES)
  assert.deepEqual(tiles.map((t) => t.pct), ['69', '24', '7', '<1'])
  const other = tiles[3]
  assert.equal(other.other, true)
  assert.equal(other.code, null)
  assert.equal(other.mph, '–')
  assert.equal(other.family, 'other')
})

test('several small pitches fold into ONE "Other" tile, last', () => {
  const tiles = pitchTiles([row('FF', 900, 95), row('SL', 60, 85), row('CU', 20, 78), row('CH', 20, 86)])
  assert.equal(tiles.length, 3)
  assert.equal(tiles[2].other, true)
  assert.equal(tiles[2].pct, '4')
  assert.equal(tiles.reduce((n, t) => n + Number(t.pct), 0), 100)
})

test('the tiles always add to 100', () => {
  for (const rows of [FUENTES, PAINTER, [row('FF', 1, 90), row('SL', 1, 80), row('CH', 1, 85)]]) {
    const sum = pitchTiles(rows).reduce((n, t) => n + (t.pct === '<1' ? 0 : Number(t.pct)), 0)
    assert.equal(sum, 100)
  }
})

test('no rows, no tiles', () => {
  assert.deepEqual(pitchTiles(null), [])
  assert.deepEqual(pitchTiles([]), [])
})

test('5 tiles or fewer is one row; more is two rows of ceil(n / 2)', () => {
  assert.equal(tileColumns(3), 3)
  assert.equal(tileColumns(5), 5)
  assert.equal(tileColumns(6), 3)
  assert.equal(tileColumns(7), 4) // Painter: 4 + 3
})

// ---- Flags, rest, last appearance ---------------------------------------------

const last = (date, extra = {}) => ({
  date, gamePk: 1, gameNumber: 1, gameType: 'R', seriesGameNumber: null, team: 'ATL', opponent: 'PHI',
  home: true, sportId: 1, inningsPitched: '1.0', pitches: 16, battersFaced: 3, hits: 0, runs: 0,
  earnedRuns: 0, strikeOuts: 1, baseOnBalls: 0, ...extra,
})

test('"Pitched yesterday": a reliever who pitched the day before', () => {
  assert.equal(entryFlag({ role: 'setup', relief: true, last: last('2026-09-29'), officialDate: '2026-09-30' }), 'Pitched yesterday')
  assert.equal(entryFlag({ role: 'closer', relief: true, last: last('2026-09-27'), officialDate: '2026-09-29' }), null) // Duran
  assert.equal(entryFlag({ role: 'setup', relief: true, last: last('2026-09-30'), officialDate: '2026-10-01' }), 'Pitched yesterday')
  assert.equal(entryFlag({ role: 'setup', relief: true, last: last('2026-08-31'), officialDate: '2026-09-01' }), 'Pitched yesterday')
})

test('"Starter in relief": role is starter and he enters as a reliever', () => {
  assert.equal(entryFlag({ role: 'starter', relief: true, last: last('2026-09-24'), officialDate: '2026-09-30' }), 'Starter in relief') // Painter
  assert.equal(entryFlag({ role: 'starter', relief: false, last: last('2026-09-24'), officialDate: '2026-09-30' }), null) // Mahle
})

test('days of rest: starters only', () => {
  assert.equal(restLabel('starter', last('2026-09-25'), '2026-09-30'), '4 days’ rest') // Sánchez
  assert.equal(restLabel('starter', last('2026-09-24'), '2026-09-30'), '5 days’ rest') // Painter, Mahle
  assert.equal(restLabel('starter', last('2026-09-28'), '2026-09-30'), '1 day’s rest')
  assert.equal(restLabel('setup', last('2026-09-25'), '2026-09-30'), '')
  assert.equal(restLabel('starter', null, '2026-09-30'), '')
})

test('heading: weekday, date, vs or @, and the round for a postseason game', () => {
  const lee = last('2026-09-29', { gameType: 'F', seriesGameNumber: 1, gamePk: 849845 })
  assert.deepEqual(lastAppearanceHeading(lee, 2026, 1), {
    when: 'Tue 9/29 vs PHI',
    round: 'WC Gm 1',
    tag: '',
    path: '/09292026/phiatl/boxscore',
  })
  const away = last('2026-09-24', { home: false, team: 'PHI', opponent: 'MIL', gamePk: 823411 })
  const h = lastAppearanceHeading(away, 2026, 1)
  assert.equal(h.when, 'Thu 9/24 @ MIL')
  assert.equal(h.round, '')
  assert.equal(h.path, '/09242026/phimil/boxscore')
})

test('heading: a game 2 links to the doubleheader path', () => {
  assert.equal(lastAppearanceHeading(last('2026-07-04', { gameNumber: 2 }), 2026, 1).path, '/07042026/phiatl-2/boxscore')
})

test('heading: a level or year tag when the game was not at this level or season', () => {
  assert.equal(lastAppearanceHeading(last('2026-08-01', { sportId: 11 }), 2026, 1).tag, 'AAA')
  assert.equal(lastAppearanceHeading(last('2025-09-20'), 2026, 1).tag, '2025')
  assert.equal(lastAppearanceHeading(last('2025-09-20', { sportId: 11 }), 2026, 1).tag, 'AAA 2025')
  // A MiLB game's own level is no tag; a big-league game seen from AAA is one.
  assert.equal(lastAppearanceHeading(last('2026-08-01', { sportId: 11 }), 2026, 11).tag, '')
  assert.equal(lastAppearanceHeading(last('2026-08-01'), 2026, 11).tag, 'MLB')
  assert.equal(lastAppearanceHeading(last('2026-08-01'), '2026', 1).tag, '')
})

test('last appearance cells: the box score order without R/L, no decision', () => {
  const cells = lastAppearanceCells(last('2026-09-25', { inningsPitched: '7.0', pitches: 100, battersFaced: 27, hits: 5, runs: 2, earnedRuns: 2, baseOnBalls: 1, strikeOuts: 10 }))
  assert.deepEqual(cells.map((c) => c.label), ['IP', 'P', 'BF', 'H', 'R', 'ER', 'BB', 'K'])
  assert.deepEqual(cells.map((c) => c.value), ['7.0', '100', '27', '5', '2', '2', '1', '10'])
})

// ---- The scene model ------------------------------------------------------------

// Every point of every pitch type, both hands, 70-103 mph, stays inside the
// scene and above the bottom bar — the BALL, not only its centre (radius =
// ball px / 2). The design measured 8.2 (highest edge) and 173.7 (lowest).
test('every arc stays inside 336 × 177 (above the bar)', () => {
  assert.equal(SCENE_W, 336)
  assert.equal(SCENE_H, 204)
  assert.equal(BAR_TOP, 177)
  let top = Infinity
  let bottom = -Infinity
  for (const code of Object.keys(MOVE)) {
    for (const lefty of [false, true]) {
      for (let mph = 70; mph <= 103; mph += 0.5) {
        for (const [x, y, px] of arc(code, mph, lefty)) {
          const r = px / 2
          assert.ok(r > 0)
          assert.ok(x - r >= 0 && x + r <= SCENE_W, `${code} ${lefty ? 'L' : 'R'} ${mph}: x ${x}`)
          assert.ok(y - r >= 0 && y + r <= BAR_TOP, `${code} ${lefty ? 'L' : 'R'} ${mph}: y ${y}`)
          top = Math.min(top, y - r)
          bottom = Math.max(bottom, y + r)
        }
      }
    }
  }
  assert.equal(top.toFixed(1), '8.2')
  assert.equal(bottom.toFixed(1), '173.7')
})

test('a left-hander mirrors a right-hander about the plate', () => {
  const r = arc('SL', 86, false)
  const l = arc('SL', 86, true)
  assert.equal(r.length, 41)
  for (let i = 0; i < r.length; i += 1) {
    assert.ok(Math.abs(r[i][0] - 168 - (168 - l[i][0])) < 1e-9)
    assert.ok(Math.abs(r[i][1] - l[i][1]) < 1e-9)
  }
})

test('the scene draws only pitches with a shape: no "Other", no knuckleball', () => {
  const tiles = pitchTiles([row('FF', 500, 95), row('KN', 300, 76), row('SL', 190, 85), row('CU', 10, 78)])
  const pitches = scenePitches(tiles, false)
  assert.deepEqual(pitches.map((p) => p.code), ['FF', 'SL'])
})

test('timing: one slot per pitch, the max flight × 3 + 0.9 s, in order of use', () => {
  const pitches = scenePitches(pitchTiles(PAINTER), false)
  const slot = Math.max(...pitches.map((p) => p.T)) * 3 + 0.9
  assert.deepEqual(sceneFrame(pitches, 0), { idx: 0, progress: 0 })
  assert.equal(sceneFrame(pitches, slot * 1.5).idx, 1)
  assert.equal(sceneFrame(pitches, slot * 7 + 0.01).idx, 0) // wraps after the 7th
  // Holds at the plate for the rest of the slot.
  assert.equal(sceneFrame(pitches, slot - 0.1).progress, 1)
  // No clock yet (or reduced motion): the active pitch at full length.
  assert.deepEqual(sceneFrame(pitches, null), { idx: 0, progress: 1 })
})
