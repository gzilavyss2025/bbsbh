import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clubChip,
  doorFigure,
  figLine,
  gameLinesView,
  handTable,
  meetingDate,
  readFigs,
  scopeText,
  seasonChoices,
  sitTable,
  vsTeamLine,
} from '../src/screens/player/next/modules/splits/splitsView.js'

// A split with easy sums: obp = (h + bb) / (ab + bb), slg = tb / ab.
const stat = (pa, ab, h, bb, tb, so, hr, avg, obp, slg, ops, pitching) => ({
  [pitching ? 'battersFaced' : 'plateAppearances']: pa,
  atBats: ab, hits: h, baseOnBalls: bb, totalBases: tb, strikeOuts: so, homeRuns: hr, avg, obp, slg, ops,
})
const split = (code, s) => ({ split: { code }, stat: s })
const hit = (pitching) => [
  split('vl', stat(110, 100, 25, 10, 40, 33, 3, '.250', '.318', '.400', '.718', pitching)),
  split('vr', stat(340, 300, 90, 40, 150, 68, 12, '.300', '.382', '.500', '.882', pitching)),
]

test('hitting: baseline is the sum of vs L and vs R; delta, best and weak read against it', () => {
  const t = handTable(hit(false), 'hitting', 'Season')
  assert.deepEqual(t.rows.map((r) => r.label), ['vs LHP', 'vs RHP'])
  assert.equal(t.base.count, '450')
  assert.equal(t.base.ops, '.842')
  assert.equal(t.base.delta, 'base')
  assert.equal(t.rows[0].delta, '−.124')
  assert.equal(t.rows[1].delta, '+.040')
  assert.deepEqual(t.rows.map((r) => [r.best, r.weak]), [[false, true], [true, false]])
  assert.equal(t.rows[0].fill.kind, 'neg')
  assert.equal(t.rows[1].fill.kind, 'pos')
  assert.equal(t.rows[1].k, '20%')
  assert.equal(t.rows[1].rest, '/.382/.500')
})

test('pitching: "All batters" is vs L + vs R, the lowest OPS against is best', () => {
  const t = handTable(hit(true), 'pitching', 'Season')
  assert.deepEqual(t.rows.map((r) => r.label), ['vs LHB', 'vs RHB'])
  assert.equal(t.base.count, '450')
  assert.deepEqual(t.rows.map((r) => [r.best, r.weak]), [[true, false], [false, true]])
  assert.equal(t.rows[0].fill.kind, 'pos', 'under the line is the pitcher side')
})

test('a thin row (under 100 PA) is never flagged and has no colour', () => {
  const raw = [split('vl', stat(60, 55, 10, 5, 20, 20, 1, '.182', '.250', '.364', '.614')), hit(false)[1]]
  const t = handTable(raw, 'hitting', 'Season')
  assert.equal(t.rows[0].thin, true)
  assert.equal(t.rows[0].fill.kind, 'thin')
  assert.deepEqual(t.rows.map((r) => [r.best, r.weak]), [[false, false], [false, false]])
})

test('no vs L or vs R row gives null', () => {
  assert.equal(handTable([], 'hitting', 'Season'), null)
  assert.equal(handTable(null, 'pitching', 'Season'), null)
})

test('situational rows read against the hand baseline and rank inside each family', () => {
  const hand = handTable(hit(false), 'hitting', 'Season')
  const row = (code, ops) => split(code, stat(150, 130, 35, 15, 60, 30, 4, '.269', '.340', '.460', ops))
  const raw = [row('r0', '.760'), row('ron', '.900'), row('risp', '.950'), row('ac', '.800'), row('bc', '.700'), row('2s', '.600')]
  const t = sitTable(raw, 'hitting', 'Season', hand.baseSide, 4)
  assert.deepEqual(t.groups.map((g) => g.title), ['Base state', 'Count'])
  assert.deepEqual(t.groups[0].rows.map((r) => [r.label, Boolean(r.nested)]), [['Empty', false], ['Runners on', false], ['RISP', true]])
  assert.equal(t.base.count, hand.base.count)
  assert.equal(t.groups[0].rows[2].best, true)
  assert.equal(t.groups[0].rows[0].weak, true)
  assert.equal(t.groups[1].rows[2].weak, true)
  assert.equal(t.groups[1].rows[0].delta, '−.042')
})

test('situational: fewer rows than the floor gives null; the floor drops for October', () => {
  const raw = [split('r0', stat(150, 130, 35, 15, 60, 30, 4, '.269', '.340', '.460', '.800'))]
  assert.equal(sitTable(raw, 'hitting', 'Season', null, 4), null)
  assert.equal(sitTable(raw, 'hitting', 'Postseason', null, 1).groups[0].rows.length, 1)
})

test('seasonChoices: the last four seasons from the season prop, none before the debut, then Career', () => {
  assert.deepEqual(seasonChoices(2026, 2018), ['2026', '2025', '2024', '2023', 'career'])
  assert.deepEqual(seasonChoices(2026, 2024), ['2026', '2025', '2024', 'career'])
  assert.deepEqual(seasonChoices(2026, null), ['2026', '2025', '2024', '2023', 'career'])
})

test('scopeText names the baseline row and the card tag', () => {
  assert.deepEqual(scopeText('2026', 'R'), { base: 'Season', tag: '2026 · full season' })
  assert.deepEqual(scopeText('2026', 'A'), { base: 'All games', tag: '2026 · season + postseason' })
  assert.deepEqual(scopeText('career', 'P'), { base: 'Postseason', tag: 'Career · postseason' })
  assert.deepEqual(scopeText('career', 'A'), { base: 'All games', tag: 'Career · regular + postseason' })
})

const door = (g, pa, avg, obp, slg, ops, hr, so, bb) => ({
  gamesPlayed: g, plateAppearances: pa, avg, obp, slg, ops, homeRuns: hr, strikeOuts: so, baseOnBalls: bb,
})

test('a hitter door: wide cells, OPS bar read against the career line', () => {
  const base = figLine('career', 'Career', door(599, 2406, '.260', '.336', '.391', '.727', 52, 530, 240), 'hitting')
  const home = figLine('home', 'Home', door(304, 1183, '.254', '.336', '.392', '.728', 26, 260, 130), 'hitting')
  const pinch = figLine('ph', 'Pinch hitting', door(21, 21, '.300', '.333', '.500', '.833', 1, 8, 1), 'hitting')
  assert.equal(home.count, '1,183')
  assert.equal(home.rest, '/.336/.392')
  assert.equal(home.k, '22%')
  const [h, p] = readFigs(base, [home, pinch], 'hitting')
  assert.equal(h.delta, '+.001')
  assert.equal(p.thin, true)
  assert.equal(p.fill.kind, 'thin')
})

test('a games-only door (Started) keeps its G and carries no bar', () => {
  const line = figLine('start', 'Started', { gamesPlayed: 554 }, 'hitting', { lineKind: 'games' })
  assert.equal(line.g, '554')
  assert.equal(line.none, true)
  assert.equal(line.count, undefined)
})

test('a pitcher door: ERA is the bar, lowest is best, under 20 IP is thin', () => {
  const p = (g, ip, era, k, bb) => ({ gamesPlayed: g, inningsPitched: ip, era, strikeOuts: k, baseOnBalls: bb })
  const base = figLine('career', 'Career', p(28, '143.0', '3.66', 124, 40), 'pitching')
  const lines = [
    figLine('home', 'Home', p(16, '80.1', '2.80', 73, 22), 'pitching'),
    figLine('road', 'Road', p(12, '62.2', '4.60', 51, 18), 'pitching'),
    figLine('turf', 'On turf', p(1, '6.0', '6.00', 0, 0), 'pitching'),
  ]
  const [home, road, turf] = readFigs(base, lines, 'pitching')
  assert.deepEqual([home.delta, road.delta], ['−0.86', '+0.94'])
  assert.deepEqual([home.best, road.weak], [true, true])
  assert.equal(home.fill.kind, 'pos')
  assert.equal(turf.thin, true)
  assert.deepEqual([turf.best, turf.weak], [false, false])
})

test('vs team: no OBP, SLG or strikeouts in the shard shows a dash, never 0%', () => {
  const car = { g: 11, pa: 39, ab: 33, h: 9, avg: '.273', hr: 2, bb: 6, ops: '.870' }
  const line = vsTeamLine(car, 'vs LAA', 'hitting')
  assert.equal(line.k, '—')
  assert.equal(line.bb, '15%')
  assert.equal(line.rest, '/—/—')
  const full = vsTeamLine({ ...car, obp: '.375', slg: '.495', so: 8 }, 'vs LAA', 'hitting')
  assert.equal(full.rest, '/.375/.495')
  assert.equal(full.k, '21%')
})

test('club chips: OPS for a bat, ERA for an arm; not faced and thin are marked', () => {
  const bat = clubChip({ id: 1, abbr: 'AZ', name: 'Diamondbacks', has: true }, { car: { g: 8, pa: 38, ops: '.567' } }, 'hitting')
  assert.deepEqual([bat.text, bat.thin, bat.faced], ['.567', true, true])
  const arm = clubChip({ id: 2, abbr: 'ATL', name: 'Braves', has: false }, undefined, 'pitching')
  assert.deepEqual([arm.text, arm.faced], ['—', false])
  const arm2 = clubChip({ id: 3, abbr: 'SD', name: 'Padres', has: true }, { car: { g: 2, ip: '12.0', era: '3.00' } }, 'pitching')
  assert.deepEqual([arm2.text, arm2.thin], ['3.00', true])
})

test('meetingDate: the season prop decides when the year shows', () => {
  assert.equal(meetingDate('2026-07-05', 2026), '7/5')
  assert.equal(meetingDate('2024-09-20', 2026), '9/20/24')
})

test('game lines: figure doors in their section, a month run of three folds, lists stand unread', () => {
  const row = (key, section, extra = {}) => ({ key, section, label: key, ...extra })
  const rows = [
    row('home', 'where'), row('road', 'where'), row('park', 'where', { list: true }),
    row('m1', 'when', { family: 'month', label: 'March' }), row('m2', 'when', { family: 'month', label: 'April' }), row('m3', 'when', { family: 'month', label: 'May' }),
    row('post', 'counted'),
  ]
  const s = (ops, pa) => door(100, pa, '.250', '.330', '.400', ops, 5, 90, 40)
  const labels = new Map([['home', s('.800', 400)], ['road', s('.650', 400)], ['m1', s('.900', 120)], ['m2', s('.700', 300)], ['m3', s('.760', 300)], ['post', s('.600', 30)]])
  const v = gameLinesView({ rows, labels }, door(599, 2406, '.260', '.336', '.391', '.727', 52, 530, 240), 'hitting')
  assert.deepEqual(v.sections.map((x) => x.key), ['where', 'when', 'counted'])
  const [home, road, park] = v.sections[0].items
  assert.deepEqual([home.best, road.weak, park.list, park.delta], [true, true, true, undefined])
  const fold = v.sections[1].items[0].fold
  assert.deepEqual([fold.count, fold.best, fold.weak], [3, 'Mar .900', 'Apr .700'])
  assert.equal(gameLinesView({ rows, labels: new Map() }, door(1, 1, '.2', '.2', '.2', '.5', 0, 0, 0), 'hitting'), null)
  assert.equal(gameLinesView({ rows, labels }, null, 'hitting'), null)
})

test('doorFigure finds a door by its key, and shows a dash when the door has no games', () => {
  const p = (g, ip, era) => ({ gamesPlayed: g, inningsPitched: ip, era, strikeOuts: 1, baseOnBalls: 1 })
  const rows = [
    { key: 'home', section: 'where', label: 'Home' },
    { key: 'road', section: 'where', label: 'Road' },
  ]
  const base = p(28, '143.0', '3.66')
  const both = gameLinesView({ rows, labels: new Map([['home', p(16, '80.1', '2.80')], ['road', p(12, '62.2', '4.60')]]) }, base, 'pitching')
  assert.deepEqual([doorFigure(both, 'home', 'pitching'), doorFigure(both, 'road', 'pitching')], ['2.80', '4.60'])
  // No home games: the road door must not slide into the home slot.
  const noHome = gameLinesView({ rows, labels: new Map([['road', p(12, '62.2', '4.60')]]) }, base, 'pitching')
  assert.deepEqual([doorFigure(noHome, 'home', 'pitching'), doorFigure(noHome, 'road', 'pitching')], ['—', '4.60'])
})
