// The On the mound module's pure view (src/screens/player/next/modules/mound/moundView.js, #1893).
import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarFor, daysSince, defaultTab, moundView, trackFor } from '../src/screens/player/next/modules/mound/moundView.js'

// Robert Gasser's last twelve apps from workload.json (regular season, plus one Division Series start).
const gasser = {
  role: 'SP',
  season: { g: 21, gs: 20, pitches: 1817, outs: 328, gsPitches: 1735, gsOuts: 312 },
  apps: [
    { d: '2026-10-07', p: 56, o: 135, h: false, t: 'D', g: 849827, gs: 1 },
    { d: '2026-09-25', p: 87, o: 138, h: true, t: 'R', g: 823735, gs: 1 },
    { d: '2026-09-19', p: 107, o: 110, h: false, t: 'R', g: 824788, gs: 1 },
    { d: '2026-09-13', p: 89, o: 113, h: true, t: 'R', g: 823734, gs: 1 },
    { d: '2026-09-07', p: 83, o: 112, h: true, t: 'R', g: 823742, gs: 1 },
    { d: '2026-09-01', p: 76, o: 112, h: false, t: 'R', g: 824633, gs: 1 },
    { d: '2026-08-26', p: 82, o: 121, h: false, t: 'R', g: 823584 },
  ],
}
// Cade Smith: a reliever, no starts.
const smith = {
  role: 'RP',
  season: { g: 69, gs: 0, pitches: 1238, outs: 222, gsPitches: 0, gsOuts: 0 },
  apps: [
    { d: '2026-10-12', p: 6, o: 139, h: false, t: 'L', g: 849820 },
    { d: '2026-10-10', p: 27, o: 145, h: true, t: 'D', g: 849831 },
    { d: '2026-10-03', p: 12, o: 145, h: true, t: 'D', g: 849829 },
    { d: '2026-09-26', p: 5, o: 118, h: false, t: 'R', g: 824057 },
  ],
}

test('days since counts whole calendar days', () => {
  assert.equal(daysSince('2026-10-07', '2026-10-13'), 6)
  assert.equal(daysSince('2026-10-12', '2026-10-13'), 1)
  assert.equal(daysSince('2026-09-30', '2026-10-02'), 2)
})

test('the track: a tick a day from the last outing, the elapsed day marked, the usual gap as a zone', () => {
  const t = trackFor(6, { min: 6, max: 7 })
  assert.equal(t.days, 8)
  assert.equal(t.ticks.length, 9)
  assert.equal(t.since, 6)
  assert.equal(t.nowLeft, 75)
  assert.deepEqual(t.zone, { left: 75, width: 12.5 })
  assert.equal(trackFor(2, null).zone, null)
  // A long wait widens the track so the usual gap and today both fit.
  assert.equal(trackFor(10, { min: 6, max: 7 }).days, 12)
})

test('the calendar puts a bar at its date and brackets the days between outings, today last', () => {
  const c = calendarFor(
    [
      { d: '2026-10-01', p: 80 },
      { d: '2026-10-07', p: 100 },
    ],
    '2026-10-13',
    100,
  )
  assert.equal(c.bars.length, 2)
  assert.equal(c.bars[1].h, 100)
  assert.equal(c.bars[0].h, 80)
  assert.ok(c.bars[0].left < c.bars[1].left)
  assert.deepEqual(c.gaps.map((g) => g.n), [6, 6])
  assert.equal(c.gaps.at(-1).now, true)
  assert.deepEqual(c.dates.map((d) => d.t), ['10/1', '10/7'])
})

test('the default tab: a starter opens on Starter, a bullpen arm or a closer on Bullpen, else the one tab there is', () => {
  assert.equal(defaultTab('SP', ['starter', 'bullpen']), 'starter')
  assert.equal(defaultTab('RP', ['starter', 'bullpen']), 'bullpen')
  assert.equal(defaultTab('CL', ['starter', 'bullpen']), 'bullpen')
  assert.equal(defaultTab('SP', ['bullpen']), 'bullpen')
  assert.equal(defaultTab('RP', ['starter']), 'starter')
})

test('Gasser: 87 pitches per start, starts only (1735 / 20), and the Division Series start is tagged', () => {
  const v = moundView(gasser, '2026-10-13')
  assert.equal(v.tab, 'starter')
  const s = v.views.starter
  assert.equal(s.chart.avg, 87)
  assert.equal(s.chart.avgLabel, 'Averages 87 pitches per start')
  assert.equal(s.track.since, 6)
  assert.deepEqual(s.last, { md: '10/7', home: false, opp: 135, p: 56, tag: 'DS' })
  assert.equal(s.chart.bars.at(-1).last, true)
  // The 8/26 relief outing is a bar too, hatched.
  assert.equal(s.chart.bars[0].relief, true)
  assert.equal(moundView(smith, '2026-10-13').views.bullpen.chart.bars[0].relief, false)
  // Bullpen view needs an app inside the last fourteen days.
  assert.deepEqual(v.tabs, ['starter', 'bullpen'])
})

test('a reliever has the Bullpen tab only, averaging pitches per appearance', () => {
  const v = moundView(smith, '2026-10-13')
  assert.deepEqual(v.tabs, ['bullpen'])
  assert.equal(v.tab, 'bullpen')
  assert.equal(v.views.bullpen.chart.avg, 18)
  assert.equal(v.views.bullpen.track.since, 1)
  assert.equal(v.views.bullpen.last.tag, 'CS')
  // The 9/26 app is outside the fourteen-day window.
  assert.equal(v.views.bullpen.chart.bars.length, 3)
})

test('the cutoff: an app on or after the day is not shown, and a pitcher with none left has no card', () => {
  const v = moundView(gasser, '2026-09-25')
  assert.equal(v.views.starter.last.md, '9/19')
  assert.equal(moundView(gasser, '2026-08-26'), null)
  assert.equal(moundView(undefined, '2026-10-13'), null)
  assert.equal(moundView({ role: 'RP', apps: [] }, '2026-10-13'), null)
})

test('a start long ago is out of turn: no track, the day count only', () => {
  const v = moundView({ ...gasser, apps: [{ d: '2026-07-03', p: 110, o: 135, h: true, t: 'R', gs: 1 }] }, '2026-10-13')
  assert.equal(v.views.starter.track.since, 102)
  assert.equal(v.views.starter.track.outOfTurn, true)
  assert.deepEqual(v.tabs, ['starter'])
})

test('a long idle stretch cuts the calendar short and draws no today', () => {
  const v = moundView({ ...gasser, apps: [{ d: '2026-07-03', p: 110, gs: 1 }, { d: '2026-06-24', p: 89, gs: 1 }] }, '2026-10-13')
  assert.equal(v.views.starter.chart.live, false)
  assert.equal(v.views.starter.chart.gaps.some((g) => g.now), false)
})

test('two apps on one day (a doubleheader) still draw bars with width', () => {
  const c = calendarFor([{ d: '2026-10-01', p: 20 }, { d: '2026-10-01', p: 15 }], '2026-10-13', 30)
  assert.ok(c.bars.every((b) => b.w > 0))
})

// Wandy Peralta: a reliever (5 openers all year), one opener in his last twelve apps, nothing in the last 14 days.
const peralta = {
  role: 'RP',
  season: { g: 65, gs: 5, pitches: 1224, outs: 232, gsPitches: 62, gsOuts: 15 },
  apps: [
    { d: '2026-09-25', p: 25, o: 109, h: true, t: 'R' },
    { d: '2026-09-22', p: 24, o: 119, h: false, t: 'R' },
    { d: '2026-08-15', p: 13, o: 147, h: true, t: 'R', gs: 1 },
  ],
}

test('a reliever with one opener keeps the Bullpen tab and opens on it, though no app is in the last 14 days', () => {
  const v = moundView(peralta, '2026-10-13')
  assert.deepEqual(v.tabs, ['starter', 'bullpen'])
  assert.equal(v.tab, 'bullpen')
  assert.equal(v.views.bullpen.last.md, '9/25')
  assert.equal(v.views.bullpen.track.since, 18)
  assert.equal(v.views.bullpen.chart.bars.length, 0)
})

test('a starter with no app in the last 14 days has no Bullpen tab', () => {
  const v = moundView({ ...gasser, apps: [{ d: '2026-07-03', p: 110, gs: 1 }] }, '2026-10-13')
  assert.deepEqual(v.tabs, ['starter'])
})
