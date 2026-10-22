// The World Series home's Roster card (#2316): the stat reads never include the slate date's game,
// the starter rule, and the position-group sections.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { loadRosterLine, loadPitcherRoles, resetRosterReads } from '../../src/api/scout/rosterStats.js'
import { isStarter, rosterSections, statLine } from '../../src/lib/postseason/worldseries/scouting/roster.js'

const SLATE = '2025-10-24'
const splits = (...rows) => ({ stats: [{ splits: rows }] })
const hit = (season, g, extra = {}) => ({
  season: String(season),
  team: { id: 119 },
  stat: { gamesPlayed: g, atBats: 4 * g, hits: g, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, totalBases: g, plateAppearances: 4 * g, ...extra },
})

function withApi(route, run) {
  resetRosterReads()
  const urls = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => route(String(url)) ?? splits() }
  })
  return Promise.resolve(run(urls)).finally(() => m.mock.restore())
}

// THE SPOILER RULE. Every read ends the day before the slate date. The one read without an
// endDate is yearByYear, and its rows count only for seasons before this one.
function assertBounded(urls) {
  assert.ok(urls.length > 0)
  for (const u of urls) {
    const q = new URL(u).searchParams
    assert.notEqual(q.get('stats'), 'career', u)
    assert.notEqual(q.get('stats'), 'season', u)
    if (q.get('stats') === 'yearByYear') continue
    const end = q.get('endDate')
    assert.ok(end, `no endDate: ${u}`)
    assert.ok(end < SLATE, `endDate on or after the slate date: ${u}`)
  }
}

for (const set of ['P', 'R', 'C']) {
  test(`stat set ${set}: every read ends before the slate date`, async () => {
    await withApi(() => null, async (urls) => {
      await loadRosterLine(1, { set, groups: ['hitting', 'pitching'], slateDate: SLATE })
      assertBounded(urls)
    })
  })
}

test('pitcher roles: both reads end before the slate date', async () => {
  await withApi(() => null, async (urls) => {
    await loadPitcherRoles(119, SLATE)
    assert.equal(urls.length, 2)
    assertBounded(urls)
  })
})

test('postseason and regular season ask the right game type', async () => {
  await withApi(() => null, async (urls) => {
    await loadRosterLine(1, { set: 'P', groups: ['hitting'], slateDate: SLATE })
    await loadRosterLine(1, { set: 'R', groups: ['hitting'], slateDate: SLATE })
    assert.deepEqual(urls.map((u) => new URL(u).searchParams.get('gameType')), ['P', 'R'])
  })
})

test('career: seasons before this one plus this season to the day before; this season in yearByYear is left out', async () => {
  const route = (u) =>
    u.includes('yearByYear')
      ? splits(hit(2023, 100), hit(2024, 50), hit(2025, 999)) // 2025 is this season: left out
      : splits(hit(2025, 10), hit(2025, 10)) // byDateRange repeats a row: counted once
  const line = await withApi(route, () => loadRosterLine(1, { set: 'C', groups: ['hitting'], slateDate: SLATE }))
  assert.equal(line.hitting.gamesPlayed, 160)
  // AVG is rebuilt from the counts, never averaged.
  assert.equal(line.hitting.avg, '.250')
})

test('a traded season counts its club rows once, not the roll-up too', async () => {
  const route = (u) =>
    u.includes('yearByYear')
      ? splits(hit(2024, 30), { ...hit(2024, 20), team: { id: 120 } }, { season: '2024', numTeams: 2, stat: hit(2024, 50).stat })
      : splits()
  const line = await withApi(route, () => loadRosterLine(1, { set: 'C', groups: ['hitting'], slateDate: SLATE }))
  assert.equal(line.hitting.gamesPlayed, 50)
})

test('a failed read throws (the card shows a line), and is read again next time', async () => {
  resetRosterReads()
  let fail = true
  const m = mock.method(globalThis, 'fetch', async () => {
    if (fail) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => splits(hit(2025, 3)) }
  })
  try {
    await assert.rejects(loadRosterLine(7, { set: 'P', groups: ['hitting'], slateDate: SLATE }))
    fail = false
    const line = await loadRosterLine(7, { set: 'P', groups: ['hitting'], slateDate: SLATE })
    assert.equal(line.hitting.gamesPlayed, 3)
  } finally {
    m.mock.restore()
  }
})

test('one read per player and stat set', async () => {
  await withApi(() => null, async (urls) => {
    await loadRosterLine(1, { set: 'P', groups: ['hitting'], slateDate: SLATE })
    await loadRosterLine(1, { set: 'P', groups: ['hitting'], slateDate: SLATE })
    assert.equal(urls.length, 1)
  })
})

test('starter rule: a postseason start, else more than half his regular-season games started', () => {
  assert.equal(isStarter({ ps: { g: 3, gs: 1 }, rs: { g: 60, gs: 0 } }), true)
  // He pitched in October, but never started: a reliever now, whatever his season was.
  assert.equal(isStarter({ ps: { g: 4, gs: 0 }, rs: { g: 23, gs: 22 } }), false)
  // No October game yet: the regular season decides.
  assert.equal(isStarter({ ps: null, rs: { g: 30, gs: 30 } }), true)
  assert.equal(isStarter({ ps: null, rs: { g: 10, gs: 5 } }), false)
  assert.equal(isStarter({ ps: null, rs: null }), false)
})

test('sections: six groups in order, hitters left and pitchers right', () => {
  const p = (id, position) => ({ id, name: `P${id}`, position, jersey: String(id) })
  const roster = {
    positionPlayers: [p(1, 'C'), p(2, '1B'), p(3, 'SS'), p(4, 'CF'), p(5, 'DH'), p(6, 'TWP')],
    pitchers: [p(7, 'P'), p(8, 'P')],
  }
  const s = rosterSections(roster, new Set([8]))
  assert.deepEqual(
    s.map((x) => [x.id, x.side, x.players.map((q) => q.id)]),
    [
      ['catchers', 'hit', [1]],
      ['infielders', 'hit', [2, 3]],
      ['outfielders', 'hit', [4]],
      ['dh', 'hit', [5, 6]],
      ['starters', 'pitch', [8]],
      ['relievers', 'pitch', [7]],
    ],
  )
})

test('stat line: a missing figure is a dash; no stat is null', () => {
  const line = statLine({ gamesPlayed: 2, avg: '.250' }, 'hitting')
  assert.equal(line.cells.find((c) => c.label === 'AVG').value, '.250')
  assert.equal(line.cells.find((c) => c.label === 'HR').value, '—')
  assert.equal(statLine(null, 'hitting'), null)
  assert.equal(statLine({ gamesPlayed: 0 }, 'pitching'), null)
  const arm = statLine({ gamesPlayed: 1, inningsPitched: '6.0', wins: 1, losses: 0, era: '1.50' }, 'pitching')
  assert.deepEqual(arm.cells.map((c) => [c.label, c.value]).slice(0, 5), [['ERA', '1.50'], ['WHIP', '—'], ['IP', '6.0'], ['SO', '—'], ['W-L', '1-0']])
})

import { fitTransform, visibleBox } from '../../src/lib/postseason/worldseries/scouting/markFit.js'

function grid(w, h, rect) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) d[(y * w + x) * 4 + 3] = 255
  return d
}

test('markFit: the visible box of a padded mark fills its square', () => {
  const box = visibleBox(grid(10, 10, { x0: 3, y0: 4, x1: 7, y1: 6 }), 10, 10)
  assert.deepEqual(box, { x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.6 })
  // Longest side 0.4 -> scale 2.5; the box is already centred.
  assert.equal(fitTransform(box), 'scale(2.5) translate(0%, 0%)')
})

test('markFit: an off-centre mark is moved to the centre; an empty one is left alone', () => {
  const box = visibleBox(grid(10, 10, { x0: 0, y0: 0, x1: 5, y1: 5 }), 10, 10)
  assert.equal(fitTransform(box), 'scale(2) translate(25%, 25%)')
  assert.equal(visibleBox(new Uint8ClampedArray(400), 10, 10), null)
  assert.equal(fitTransform(null), null)
})
