// The slate-day loader (#3035): the fetch ORDER the slate depends on, driven with fake
// fetchers and a fake saved-row read. Each fetch is a deferred the test settles by hand.
import assert from 'node:assert/strict'
import test from 'node:test'
import { initialSlateDay, loadSlateDay } from '../src/lib/slate/day.js'
import { SPORT_IDS } from '../src/lib/teams.js'

const flush = () => new Promise((r) => setTimeout(r, 0))

function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => ((resolve = a), (reject = b)))
  return { promise, resolve, reject }
}

// Every fetcher records its calls and hands back a deferred the test settles.
function fakes(saved = {}) {
  const calls = []
  const pending = {}
  const fetcher = (name) => (...args) => {
    const d = deferred()
    calls.push({ name, args })
    ;(pending[name] ??= []).push(d)
    return d.promise
  }
  const f = {
    fetchSeasonMeta: fetcher('fetchSeasonMeta'),
    fetchSchedule: fetcher('fetchSchedule'),
    fetchTeams: fetcher('fetchTeams'),
    fetchAffiliates: fetcher('fetchAffiliates'),
    fetchLevelCounts: fetcher('fetchLevelCounts'),
    fetchLevelSeasonDates: fetcher('fetchLevelSeasonDates'),
    fetchWinterCalendar: fetcher('fetchWinterCalendar'),
    readSeasonRow: (id, year) => saved[`${id}:${year}`] ?? null,
    saveSeasonRow: (id, year, row) => calls.push({ name: 'save', args: [id, year, row] }),
  }
  const take = (name) => pending[name].shift()
  const called = (name) => calls.filter((c) => c.name === name)
  return { f, take, called }
}

function run(input, saved) {
  const fx = fakes(saved)
  const values = []
  const ctl = loadSlateDay(input, fx.f, (v) => values.push(v))
  return { ...fx, ctl, last: () => values.at(-1), values }
}

// A AA level's 2026 rows: the season over by Sep 23, next year's opener on the 2027 rows.
const LEVEL_2026 = [{ leagueId: 111, seasonStartDate: '2026-04-01', regularSeasonStartDate: '2026-04-03', regularSeasonEndDate: '2026-09-20', seasonEndDate: '2026-09-23', offseasonStartDate: '2026-09-24' }]
const LEVEL_2027 = [{ leagueId: 111, seasonStartDate: '2027-04-01', regularSeasonStartDate: '2027-04-02', regularSeasonEndDate: '2027-09-19', seasonEndDate: '2027-09-22', offseasonStartDate: '2027-09-23' }]
const AA = SPORT_IDS.AA
const NOV = { dateStr: '2026-11-04', sportId: AA, favoriteTeamId: 158 }

test('a level asks its own rows only after the empty day\'s season row answers (#2907)', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchWinterCalendar').resolve(null)
  await flush()
  assert.equal(r.called('fetchSeasonMeta').length, 0, 'no season row before the slate answers')
  r.take('fetchSchedule').resolve([])
  await flush()
  assert.equal(r.called('fetchSeasonMeta').length, 1, 'an empty day asks for the season row')
  assert.equal(r.called('fetchLevelSeasonDates').length, 0, 'the level rows wait on that answer')
  assert.equal(r.last().seasonMeta.loading, true)
  r.take('fetchSeasonMeta').resolve(null) // a failed MLB read still says "empty day" (#2936)
  await flush()
  assert.deepEqual(r.called('fetchLevelSeasonDates')[0].args, [AA, 2026])
  assert.equal(r.last().offseason.pending, true, 'level rows in flight: no stand-in yet')
})

test('a day with games asks neither the season row nor a level\'s rows', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchWinterCalendar').resolve(null)
  r.take('fetchSchedule').resolve([{ gamePk: 1, away: { id: 1 }, home: { id: 2 } }])
  await flush()
  assert.equal(r.last().isEmptyDay, false)
  assert.equal(r.called('fetchSeasonMeta').length, 0)
  assert.equal(r.called('fetchLevelSeasonDates').length, 0)
  assert.equal(r.last().offseason.pending, false)
})

test('saved rows decide the phase on the very first frame, before any fetch lands (#2907)', () => {
  const saved = { [`${AA}:2026`]: LEVEL_2026 }
  const first = initialSlateDay(NOV, (id, y) => saved[`${id}:${y}`] ?? null)
  assert.ok(first.offseason.phase, 'the saved level rows name the winter')
  assert.equal(first.offseason.expectWinter, true)
  assert.equal(first.slate.loading, true)
  assert.equal(first.slate.games, null)
})

test('pending holds through the forward read, then the winter lands with its countdown', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchWinterCalendar').resolve(null)
  r.take('fetchSchedule').resolve([])
  await flush()
  r.take('fetchSeasonMeta').resolve(null)
  await flush()
  r.take('fetchLevelSeasonDates').resolve(LEVEL_2026)
  await flush()
  assert.ok(r.last().offseason.phase)
  assert.equal(r.last().offseason.pending, true, 'next season\'s rows still on their way')
  assert.deepEqual(r.called('fetchLevelSeasonDates')[1].args, [AA, 2027])
  r.take('fetchLevelSeasonDates').resolve(LEVEL_2027)
  await flush()
  assert.equal(r.last().offseason.pending, false)
  assert.equal(r.last().offseason.winter.openingDay, '2027-04-02')
  const saves = r.called('save').map((c) => `${c.args[0]}:${c.args[1]}`)
  assert.ok(saves.includes(`${AA}:2026`) && saves.includes(`${AA}:2027`), 'answers are remembered')
})

test('a rejected level read settles pending, so the reserve cannot hold forever (#2928)', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchWinterCalendar').resolve(null)
  r.take('fetchSchedule').resolve([])
  await flush()
  r.take('fetchSeasonMeta').resolve(null)
  await flush()
  r.take('fetchLevelSeasonDates').reject(new Error('down'))
  await flush()
  assert.equal(r.last().offseason.pending, false)
})

test('the cards wait for the affiliates, so the pinned card never re-sorts in', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchSchedule').resolve([{ gamePk: 1, away: { id: 1 }, home: { id: 2 } }])
  await flush()
  assert.equal(r.last().slate.games, null)
  assert.equal(r.last().slate.loading, true)
  r.take('fetchAffiliates').resolve([{ id: 7 }])
  await flush()
  assert.equal(r.last().slate.games.length, 1)
  assert.ok(r.last().affiliateIds.has(7))
})

test('the winter tab fetches the calendar\'s league once it lands, never a bare sportId=17', async () => {
  const r = run({ dateStr: '2026-12-15', sportId: 17, leagueId: null, favoriteTeamId: 158 })
  await flush()
  assert.equal(r.called('fetchSchedule').length, 0, 'no league yet: no fetch at all')
  assert.deepEqual(r.last().slate.games, [], 'no league: the tab answers an empty day')
  r.take('fetchWinterCalendar').resolve({
    132: { firstDate: '2026-10-10', lastDate: '2027-01-20', gamesByDate: { '2026-12-15': 4 } },
  })
  await flush()
  assert.equal(r.last().activeLeagueId, 132)
  assert.equal(r.last().winterBall.tabVisible, true)
  assert.deepEqual(r.called('fetchSchedule').map((c) => c.args[3]), [132])
  assert.deepEqual(r.called('fetchTeams').map((c) => c.args[1]), [null, 132])
})

test('cancel voids every in-flight answer', async () => {
  const r = run(NOV)
  const n = r.values.length
  r.ctl.cancel()
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchSchedule').resolve([])
  await flush()
  assert.equal(r.values.length, n)
})

test('reload(slate) keeps the last-good games while it re-reads (an error retry)', async () => {
  const r = run(NOV)
  await flush()
  r.take('fetchAffiliates').resolve([])
  r.take('fetchSchedule').resolve([{ gamePk: 1, away: { id: 1 }, home: { id: 2 } }])
  await flush()
  r.ctl.reload('slate')
  assert.equal(r.last().slate.games.length, 1)
  assert.equal(r.last().slate.loading, true)
})

// The spoiler-rule check: the value is spoiler-free. Fed games as fetchSchedule returns them
// (fields= prunes the score), nothing in the value is a score, a linescore or a winner.
test('the slate-day value holds no score', async () => {
  const r = run({ dateStr: '2026-07-17', sportId: SPORT_IDS.MLB, favoriteTeamId: 158 })
  await flush()
  r.take('fetchSeasonMeta').resolve({ seasonId: '2026', regularSeasonStartDate: '2026-03-26' })
  r.take('fetchWinterCalendar').resolve(null)
  r.take('fetchLevelCounts').resolve({ 1: 15, 11: 14 })
  r.take('fetchTeams').resolve([{ id: 158, name: 'Milwaukee Brewers' }])
  r.take('fetchSchedule').resolve([
    { gamePk: 1, abstractState: 'Live', away: { id: 158, name: 'Brewers' }, home: { id: 112, name: 'Cubs' } },
  ])
  await flush()
  const bad = /score|runs|linescore|winner|isWinner|decisions/i
  const walk = (v, path) => {
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v instanceof Set ? [...v] : v)) {
        assert.ok(!bad.test(k), `score-like key at ${path}.${k}`)
        walk(x, `${path}.${k}`)
      }
    }
  }
  walk(r.last(), 'value')
  assert.equal(r.last().stops[0].count, '15')
})

// Paging carries every answer whose own key is unchanged (review of #3059): the ladder counts
// are one per date, the club list one per level, the bracket's season row one per year.
async function settledRun(input, seed) {
  const fx = fakes()
  const out = { values: [], raw: null }
  const ctl = loadSlateDay(input, fx.f, (v, raw) => (out.values.push(v), (out.raw = raw)), seed)
  return { ...fx, ...out, ctl, last: () => out.values.at(-1), get raw() { return out.raw } }
}

test('a new level keeps the date\'s ladder counts; a new date keeps the level\'s clubs', async () => {
  const a = await settledRun({ dateStr: '2026-07-17', sportId: SPORT_IDS.MLB, favoriteTeamId: 158 })
  await flush()
  a.take('fetchSeasonMeta').resolve(null)
  a.take('fetchWinterCalendar').resolve(null)
  a.take('fetchLevelCounts').resolve({ 1: 15, 11: 14 })
  a.take('fetchTeams').resolve([{ id: 158 }])
  a.take('fetchSchedule').resolve([{ gamePk: 1, away: { id: 1 }, home: { id: 2 } }])
  await flush()
  let raw = a.values.length && a.raw
  a.ctl.cancel()

  const b = await settledRun({ dateStr: '2026-07-17', sportId: SPORT_IDS.AAA, favoriteTeamId: 158 }, raw)
  assert.equal(b.called('fetchLevelCounts').length, 0, 'same date: the counts are not asked again')
  assert.equal(b.last().stops[1].count, '14', 'and never blank')
  assert.equal(b.called('fetchWinterCalendar').length, 0)
  b.ctl.cancel()

  const c = await settledRun({ dateStr: '2026-07-18', sportId: SPORT_IDS.MLB, favoriteTeamId: 158 }, raw)
  await flush()
  assert.equal(c.called('fetchTeams').length, 0, 'same level: the club list is not asked again')
  assert.deepEqual(c.last().levelTeams, [{ id: 158 }])
  assert.equal(c.called('fetchSeasonMeta').length, 0, 'same year: the bracket row is kept')
  assert.equal(c.called('fetchLevelCounts').length, 1, 'a new date asks its own counts')
})

test('a new favourite re-asks only the affiliates, never the slate', async () => {
  const a = await settledRun(NOV)
  await flush()
  a.take('fetchAffiliates').resolve([])
  a.take('fetchWinterCalendar').resolve(null)
  a.take('fetchLevelCounts').resolve({})
  a.take('fetchTeams').resolve([])
  a.take('fetchSchedule').resolve([{ gamePk: 1, away: { id: 1 }, home: { id: 2 } }])
  await flush()
  const raw = a.raw
  a.ctl.cancel()
  const b = await settledRun({ ...NOV, favoriteTeamId: 147 }, raw)
  assert.equal(b.called('fetchSchedule').length, 0)
  assert.equal(b.called('fetchAffiliates').length, 1)
  b.take('fetchAffiliates').resolve([])
  await flush()
  assert.equal(b.last().slate.games.length, 1)
})

test('the MLB empty day reuses the bracket\'s season row instead of asking twice', async () => {
  const r = run({ dateStr: '2026-12-01', sportId: SPORT_IDS.MLB, favoriteTeamId: 158 })
  await flush()
  r.take('fetchSeasonMeta').resolve(null)
  r.take('fetchWinterCalendar').resolve(null)
  r.take('fetchSchedule').resolve([])
  await flush()
  await flush()
  assert.equal(r.called('fetchSeasonMeta').length, 1)
  assert.equal(r.last().seasonMeta.loading, false)
})

test('an MLB day reports its bracket season row in flight, so October cards wait on it (#3024)', async () => {
  const r = run({ dateStr: '2026-10-09', sportId: SPORT_IDS.MLB, favoriteTeamId: null })
  await flush()
  assert.equal(r.last().bracketSeasonLoading, true)
  r.take('fetchSeasonMeta').resolve(null)
  await flush()
  assert.equal(r.last().bracketSeasonLoading, false, 'a failed read settles it')
  assert.equal(run({ ...NOV }).last().bracketSeasonLoading, false, 'a minor level never asks')
})
