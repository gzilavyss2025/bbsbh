import test from 'node:test'
import assert from 'node:assert/strict'

// The top of the one-scroll team page (#1107, row 5): the record spot, the form line, the two
// stretches, Last 10, the days calendar and the 30-club grid. Pure shapes over the club
// schedule and the standings the page already fetches. Offline.

const urls = []
let scheduleBody = { dates: [] }
globalThis.fetch = async (url) => {
  const u = String(url)
  urls.push(u)
  const body = u.includes('/api/v1/schedule') ? scheduleBody : {}
  return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const {
  STRETCH, formSeries, formGeometry, stretches, lastTen, daysRail, clubLine, gridCells, rankOf, flagOf, runsCaption,
} = await import('../src/screens/team/next/top/topData.js')
const { fetchTeamSchedule } = await import('../src/api/schedule.js')
const { BANDS } = await import('../src/screens/team/next/bands.js')
const { hiddenTeamSections } = await import('../src/screens/team/data/shared.js')

// One schedule row as fetchTeamSchedule shapes it. `won` null is an unplayed game, or one past the cutoff.
let pk = 0
const game = (apiDate, won, over = {}) => ({
  gamePk: ++pk, apiDate, gameNumber: 1, gameType: 'R', isHome: true,
  opponent: { id: 119, abbreviation: 'LAD' }, won, ...over,
})
// "WWL..." from a start date, one game a day.
function run(letters, start = '2026-04-01', over = {}) {
  const d = new Date(`${start}T00:00:00Z`)
  return [...letters].map((c) => {
    const row = game(d.toISOString().slice(0, 10), c === '-' ? null : c === 'W', over)
    d.setUTCDate(d.getUTCDate() + 1)
    return row
  })
}

test('formSeries: games over .500, one point a decided regular-season game, from zero', () => {
  const s = formSeries(run('WWLWL'))
  assert.deepEqual(s.points.map((p) => p.v), [0, 1, 2, 1, 2, 1])
  assert.equal(s.n, 5)
  assert.equal(s.now, 1)
  assert.equal(s.points.at(-1).date, '2026-04-05')
})

test('formSeries: skips the postseason and games with no result; nothing decided is null', () => {
  const rows = [...run('WW'), game('2026-10-02', true, { gameType: 'D' }), game('2026-10-03', null)]
  assert.equal(formSeries(rows).n, 2)
  assert.equal(formSeries(run('---')), null)
  assert.equal(formSeries([]), null)
})

test('formGeometry: the zero line sits inside the plot and the line ends on the last point', () => {
  const g = formGeometry(formSeries(run('WWWLWLLL' + 'W'.repeat(12))))
  assert.ok(g.zeroY > g.top && g.zeroY < g.bottom)
  assert.ok(g.line.startsWith(`M${g.left.toFixed(1)} ${g.zeroY.toFixed(1)}`))
  assert.equal(g.end.x, g.right)
  assert.ok(g.end.y < g.zeroY, 'a club above .500 ends above the zero line')
  assert.ok(g.ticks.every((t) => t.label.startsWith('+') || t.label.startsWith('−')))
})

test('formGeometry: a club that never left zero still gets a range', () => {
  const g = formGeometry(formSeries(run('WL')))
  assert.ok(Number.isFinite(g.zeroY) && g.bottom > g.top)
})

test('formGeometry: a label sits at the first game of each month', () => {
  const g = formGeometry(formSeries(run('W'.repeat(40), '2026-04-01')))
  assert.deepEqual(g.months.map((m) => m.label), ['Apr', 'May'])
})

test('stretches: the best and worst 15-game window by wins', () => {
  assert.equal(STRETCH, 15)
  // 15 straight wins is 15-0; 15 straight losses is 0-15, whatever is around them.
  const s = stretches(run('L'.repeat(15) + 'W'.repeat(15) + 'WL'))
  assert.deepEqual(s.best, { w: 15, l: 0 })
  assert.deepEqual(s.worst, { w: 0, l: 15 })
})

test('stretches: fewer than a window of games is null; October does not count', () => {
  assert.equal(stretches(run('W'.repeat(14))), null)
  const rows = [...run('W'.repeat(14)), game('2026-10-01', true, { gameType: 'D' })]
  assert.equal(stretches(rows), null)
})

test('lastTen: the last ten decided games, the streak, and no game past the cutoff', () => {
  const l = lastTen(run('LLWWWWLLWW' + 'WWW'))
  assert.deepEqual({ w: l.w, l: l.l, n: l.n, streak: l.streak }, { w: 8, l: 2, n: 10, streak: 'W5' })
  // Rows past the cutoff arrive with won null: they are not games yet.
  assert.deepEqual(lastTen([...run('WWL'), ...run('--', '2026-04-04')]), { w: 2, l: 1, n: 3, streak: 'L1' })
  assert.equal(lastTen(run('--')), null)
})

test('lastTen counts October, like the calendar under it', () => {
  const rows = [...run('W'.repeat(9)), game('2026-10-01', false, { gameType: 'D' })]
  assert.deepEqual(lastTen(rows).streak, 'L1')
})

test('daysRail: six days back, today, tomorrow; results before today, the next-game chip on its day', () => {
  const rows = [...run('WLW', '2026-06-04'), ...run('-', '2026-06-08'), ...run('-', '2026-06-09')]
  const r = daysRail(rows, '2026-06-08')
  assert.equal(r.days.length, 8)
  assert.equal(r.todayIdx, 6)
  assert.equal(r.days[6].date, '2026-06-08')
  assert.deepEqual(r.days.slice(0, 6).map((d) => d.chips.map((c) => c.k).join('')), ['off', 'off', 'w', 'l', 'w', 'off'])
  assert.deepEqual(r.days[6].chips, [{ k: 'next', t: 'LAD' }])
  assert.equal(r.days[7].chips[0].k, 'next')
})

test('daysRail: a result dated after the cutoff does not appear', () => {
  // ?d=2026-06-01: the page day is 06-01. The feed marks 06-01 and 06-02 final, fetchTeamSchedule nulls them.
  scheduleBody = {
    dates: [
      { games: [live('2026-05-31', true)] },
      { games: [live('2026-06-01', true)] },
      { games: [live('2026-06-02', false)] },
    ],
  }
  return fetchTeamSchedule(158, 2026, 1, '2026-05-31').then((rows) => {
    assert.ok(rows.find((g) => g.apiDate === '2026-06-01').won === null)
    const s = formSeries(rows)
    assert.equal(s.points.at(-1).date, '2026-05-31', 'the form line stops at the cutoff')
    assert.equal(lastTen(rows).n, 1)
    const r = daysRail(rows, '2026-06-01')
    const shown = r.days.flatMap((d) => d.chips.map((c) => `${d.date}:${c.k}`))
    assert.ok(!shown.some((x) => x === '2026-06-01:w' || x === '2026-06-02:l'))
    assert.ok(shown.includes('2026-05-31:w'))
    assert.equal(r.days[6].chips[0].k, 'next')
  })
})
function live(officialDate, won) {
  return {
    gamePk: ++pk, officialDate, gameType: 'R', status: { abstractGameState: 'Final' },
    teams: {
      away: { team: { id: 119, name: 'Los Angeles Dodgers', abbreviation: 'LAD' }, isWinner: !won, score: won ? 2 : 5 },
      home: { team: { id: 158, name: 'Milwaukee Brewers', abbreviation: 'MIL' }, isWinner: won, score: won ? 5 : 2 },
    },
  }
}

test('daysRail: the offseason has no next game, so no calendar', () => {
  assert.equal(daysRail(run('WWL'), '2026-11-01'), null)
  assert.equal(daysRail([], '2026-11-01'), null)
})

test('daysRail: a doubleheader draws both chips; the label says Postseason days when October is in view', () => {
  const dh = [game('2026-06-07', true, { gameNumber: 1 }), game('2026-06-07', false, { gameNumber: 2 }), game('2026-06-08', null)]
  assert.deepEqual(daysRail(dh, '2026-06-08').days[5].chips.map((c) => c.k), ['w', 'l'])
  const post = [game('2026-10-13', true, { gameType: 'L' }), game('2026-10-15', null, { gameType: 'L' })]
  const r = daysRail(post, '2026-10-15')
  assert.equal(r.post, true)
  assert.equal(r.month, 'Oct')
  assert.equal(daysRail(dh, '2026-06-08').post, false)
})

// ---- the record spot and the grid

const rec = (id, w, l, over = {}) => ({
  team: { id, name: `Club ${id}` }, wins: w, losses: l, leagueRecord: { pct: (w / (w + l)).toFixed(3).replace(/^0/, '') },
  runsScored: 800, runsAllowed: 700, runDifferential: 100, sportRank: '1', divisionRank: '1', leagueRank: '1', ...over,
})
const standings = [
  { division: { id: 205 }, teamRecords: [rec(158, 103, 59, { runsScored: 832, runsAllowed: 618, runDifferential: 214, clinchIndicator: 'z', streak: { streakCode: 'W5' } }), rec(112, 90, 72, { divisionRank: '2' })] },
  { division: { id: 204 }, teamRecords: [rec(138, 80, 82)] },
]
const brewers = { id: 158, name: 'Milwaukee Brewers', sport: { id: 1 }, league: { id: 104 }, division: { id: 205, name: 'National League Central' } }

test('clubLine: record, win pct, runs, rank of 30 and the clinch flag, for an MLB club', () => {
  const c = clubLine(standings, brewers)
  assert.equal(c.record, '103-59')
  assert.equal(c.pct, '.636')
  assert.deepEqual({ rs: c.rs, ra: c.ra, diff: c.diff }, { rs: 832, ra: 618, diff: '+214' })
  assert.deepEqual(c.rank, { rank: 1, of: 30 })
  assert.deepEqual(c.flag, { letter: 'z', word: 'Clinched' })
  assert.equal(c.divisionName, 'NL Central')
})

test('clubLine: no standings row is null; a thin feed has no flag, no rank, no runs', () => {
  assert.equal(clubLine([], brewers), null)
  const thin = [{ division: { id: 205 }, teamRecords: [{ team: { id: 158 }, wins: 1, losses: 0 }] }]
  const c = clubLine(thin, brewers)
  assert.equal(c.record, '1-0')
  assert.equal(c.flag, null)
  assert.equal(c.rank, null)
  assert.equal(c.diff, null)
})

test('rankOf and flagOf', () => {
  assert.deepEqual(rankOf({ sportRank: '12' }, { sport: { id: 1 } }, 6), { rank: 12, of: 30 })
  assert.deepEqual(rankOf({ divisionRank: '2' }, { sport: { id: 14 } }, 6), { rank: 2, of: 6 })
  assert.equal(rankOf({}, { sport: { id: 14 } }, 6), null)
  assert.deepEqual(flagOf('e'), { letter: 'e', word: 'Eliminated' })
  assert.equal(flagOf(undefined), null)
  assert.equal(flagOf('q'), null)
})

test('gridCells: best record first, the club marked, tiers by place, a diagonal ink order', () => {
  const records = standings.flatMap((d) => d.teamRecords)
  const cells = gridCells(records, 138)
  assert.deepEqual(cells.map((c) => c.id), [158, 112, 138])
  assert.equal(cells.find((c) => c.id === 138).tier, 'me')
  assert.deepEqual(cells.map((c) => c.g), ['.636', '.556', '.494'])
  // Five columns: cell 5 is row 1, column 0, so it inks after cell 4 (row 0, column 4).
  const many = gridCells(Array.from({ length: 30 }, (_, k) => rec(k + 1, 100 - k, 62 + k)), 1)
  assert.equal(many[4].i, 4)
  assert.equal(many[5].i, 1)
  assert.equal(many[0].tier, 'me')
  assert.deepEqual([many[1].tier, many[5].tier, many[6].tier, many[17].tier, many[18].tier], ['hi', 'hi', 'mid', 'mid', 'lo'])
})

test('gridCells follows the feed sportRank on a tie, so the grid and the record spot agree', () => {
  // Same pct (.625), different wins: a wins tie-break puts 100-60 first; the feed puts the 50-30 club first.
  const cells = gridCells([rec(1, 100, 60, { sportRank: '2' }), rec(2, 50, 30, { sportRank: '1' })], 1)
  assert.deepEqual(cells.map((c) => c.id), [2, 1])
})

test('runsCaption needs both runs; a missing runs-allowed gives no caption, never "null"', () => {
  assert.equal(runsCaption({ rs: 832, ra: 618 }), '832 for · 618 against')
  assert.equal(runsCaption({ rs: 700, ra: null }), null)
  assert.equal(runsCaption({ rs: null, ra: 700 }), null)
  assert.equal(runsCaption(null), null)
})

test('the page keeps its seven bands, the standing key and folder, and its hidden rules', () => {
  assert.deepEqual(BANDS.map((b) => b.key), ['standings', 'roster', 'ranks', 'games', 'farm', 'money', 'about'])
  assert.equal(BANDS[0].label, 'Standings')
  assert.deepEqual([...hiddenTeamSections({ sport: { id: 1 }, league: { id: 104 } })], [])
  assert.deepEqual([...hiddenTeamSections({ sport: { id: 14 }, league: { id: 123 }, parentOrgId: 158 })], ['money'])
  assert.deepEqual([...hiddenTeamSections({ sport: { id: 17 }, league: { id: 9 }, parentOrgId: 11 })].sort(), ['farm', 'money'])
})
