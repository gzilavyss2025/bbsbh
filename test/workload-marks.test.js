// Unit coverage for the four workload marks' derivations (src/api/workload.js's
// tiredFlagsFor / restRunsFor / compareArms / staffGridFor / clubPenCounts /
// penDotsFrom).
//
// The marks replace prose on six surfaces, so what these tests protect is the
// invariant that made that safe: a mark and a verdict about the same pitcher
// read from ONE evaluation of the rules. A bar drawn past its tick and a tag
// reading "likely down" cannot come apart, because both come from the same
// tiredFlagsFor call.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  availabilityFor,
  clubPenCounts,
  compareArms,
  dayStripFor,
  penDotsFrom,
  restRunsFor,
  staffGridFor,
  tiredFlagsFor,
  TIRED_FLAGS,
} from '../src/api/workload.js'

const AS_OF = '2026-08-31'

// Yennier Cano's real record on 2026-08-31, the case that drove the design:
// three straight days, none of them heavy. Every cell is under the 25-pitch
// band, so shading alone says nothing — the verdict rests entirely on the
// consecutive-day pattern.
const CANO = {
  name: 'Cano',
  teamId: 110,
  role: 'RP',
  season: { g: 59, gs: 0, pitches: 692, outs: 132, bf: 180, strikes: 442 },
  apps: [
    { d: '2026-08-30', p: 10 },
    { d: '2026-08-29', p: 11 },
    { d: '2026-08-28', p: 3 },
    { d: '2026-08-25', p: 5 },
    { d: '2026-08-19', p: 6 },
  ],
}

// The other real case: two pitch-count flags, no consecutive days.
const WILSON = {
  name: 'Wilson',
  teamId: 110,
  role: 'RP',
  season: { g: 40, gs: 0, pitches: 500, outs: 120, bf: 150, strikes: 320 },
  apps: [
    { d: '2026-08-30', p: 42 },
    { d: '2026-08-26', p: 22 },
  ],
}

// Worked the most pitches on the staff and trips nothing.
const NUNEZ = {
  name: 'Nunez',
  teamId: 110,
  role: 'RP',
  season: { g: 50, gs: 0, pitches: 600, outs: 140, bf: 170, strikes: 380 },
  apps: [
    { d: '2026-08-30', p: 15 },
    { d: '2026-08-27', p: 21 },
    { d: '2026-08-25', p: 27 },
  ],
}

// A rotation arm, to prove the grid drops him: availabilityFor answers 'fresh'
// for every starter by design, so counting one would flatter the club.
const STARTER = {
  name: 'Starter',
  teamId: 110,
  role: 'SP',
  season: { g: 27, gs: 27, pitches: 2200, outs: 480, bf: 640, strikes: 1400 },
  apps: [{ d: '2026-08-30', p: 97, gs: 1 }],
}

const data = {
  asOf: AS_OF,
  baselines: { RP: { last10: { mean: 201.6, sd: 113.2, n: 222 } }, SP: { last10: { mean: 845.9 } } },
  pitchers: { cano: CANO, wilson: WILSON, nunez: NUNEZ, starter: STARTER },
}

test('tiredFlagsFor: measures against the published thresholds, in a fixed order', () => {
  const flags = tiredFlagsFor(data, 'wilson', AS_OF)
  assert.deepEqual(
    flags.map((f) => f.key),
    TIRED_FLAGS.map((f) => f.key),
  )
  const by = Object.fromEntries(flags.map((f) => [f.key, f]))
  assert.equal(by.yesterday.value, 42)
  assert.equal(by.yesterday.threshold, 25)
  assert.equal(by.yesterday.tripped, true)
  assert.equal(by.threeDay.value, 42)
  assert.equal(by.threeDay.tripped, true)
  assert.equal(by.inARow.value, 1)
  assert.equal(by.inARow.tripped, false)
})

test('tiredFlagsFor: a pitcher who did not work yesterday measures zero, not his last outing', () => {
  // Nunez threw 27 on Aug 25. That says nothing about yesterday, and reading it
  // as a "yesterday" measure would trip a flag on an arm with two days of rest.
  const by = Object.fromEntries(tiredFlagsFor(data, 'nunez', '2026-08-27').map((f) => [f.key, f]))
  assert.equal(by.yesterday.value, 0)
  assert.equal(by.yesterday.tripped, false)
})

test('tiredFlagsFor: the consecutive-day flag alone carries a hard threshold', () => {
  const by = Object.fromEntries(tiredFlagsFor(data, 'cano', AS_OF).map((f) => [f.key, f]))
  assert.equal(by.inARow.value, 3)
  assert.equal(by.inARow.hardAt, 3)
  assert.equal(by.inARow.hard, true)
  // Neither pitch-count flag trips: this verdict is the pattern's alone.
  assert.equal(by.yesterday.tripped, false)
  assert.equal(by.threeDay.tripped, false)
  assert.equal(by.yesterday.hard, false)
  assert.equal(by.threeDay.hard, false)
})

test('tiredFlagsFor: a starter is not judged by bullpen thresholds', () => {
  assert.equal(tiredFlagsFor(data, 'starter', AS_OF), null)
  assert.equal(tiredFlagsFor(data, 'nobody', AS_OF), null)
})

test('availabilityFor: the verdict and the drawn flags are ONE evaluation', () => {
  // The whole point of the refactor. If these could disagree, a bar short of
  // its tick could sit under a "likely down" tag on the same card.
  for (const id of ['cano', 'wilson', 'nunez']) {
    const avail = availabilityFor(data, id, AS_OF)
    assert.deepEqual(avail.flags, tiredFlagsFor(data, id, AS_OF))
    const tripped = avail.flags.filter((f) => f.tripped).length
    const hard = avail.flags.some((f) => f.hard)
    const expected = hard || tripped >= 2 ? 'down' : tripped === 1 ? 'limited' : 'fresh'
    assert.equal(avail.status, expected, `${id} verdict must follow its own flags`)
  }
})

test('availabilityFor: three straight days files an arm down with no pitch-count flag', () => {
  assert.equal(availabilityFor(data, 'cano', AS_OF).status, 'down')
  assert.equal(availabilityFor(data, 'wilson', AS_OF).status, 'down')
  assert.equal(availabilityFor(data, 'nunez', AS_OF).status, 'fresh')
})

test('restRunsFor: only runs of two or more, as index spans over the strip', () => {
  const strip = dayStripFor(data, 'cano', AS_OF, 14)
  const runs = restRunsFor(strip)
  assert.equal(runs.length, 1, 'the lone Aug 25 outing is not a run')
  assert.equal(runs[0].len, 3)
  // The run must cover exactly the three worked cells it spans.
  const covered = strip.slice(runs[0].start, runs[0].start + runs[0].len)
  assert.deepEqual(covered.map((c) => c.pitches), [3, 11, 10])
})

test('restRunsFor: a run ending on the last worked cell is still closed', () => {
  // The loop runs one index PAST the strip to close a trailing run; without
  // that, a pitcher who worked the final cells would draw no rail at all.
  const cells = [{ pitches: null }, { pitches: 12 }, { pitches: 9 }]
  assert.deepEqual(restRunsFor(cells), [{ start: 1, len: 2 }])
  assert.deepEqual(restRunsFor([]), [])
  assert.deepEqual(restRunsFor(null), [])
})

test('compareArms: status outranks load, so an unavailable arm sorts above a busier available one', () => {
  // The bug this fixes. Cano threw 29 pitches over the week and is unavailable;
  // Nunez threw 63 and is fine. Ranked on pitches alone Cano sorted BELOW him —
  // and he is the row a reader opened the board for. Down-then-load puts the
  // two down arms first (Wilson ahead of Cano on load), Nunez last.
  const rows = staffGridFor(data, 110, AS_OF)
  assert.deepEqual(rows.map((r) => r.name), ['Wilson', 'Cano', 'Nunez'])
  const cano = rows.findIndex((r) => r.name === 'Cano')
  const nunez = rows.findIndex((r) => r.name === 'Nunez')
  assert.ok(cano < nunez, 'the down arm outranks the available one')
  assert.ok(
    rows[cano].last7dayPitches < rows[nunez].last7dayPitches,
    '…even though he threw fewer pitches, which is the whole point',
  )
})

test('compareArms: equal status falls back to load, then to name', () => {
  const a = { status: 'fresh', last7dayPitches: 40, name: 'Aaa' }
  const b = { status: 'fresh', last7dayPitches: 10, name: 'Bbb' }
  const c = { status: 'fresh', last7dayPitches: 10, name: 'Abb' }
  assert.deepEqual([b, a].sort(compareArms).map((x) => x.name), ['Aaa', 'Bbb'])
  assert.deepEqual([b, c].sort(compareArms).map((x) => x.name), ['Abb', 'Bbb'])
})

test('staffGridFor: relievers only, each row carrying its own strip and runs', () => {
  const rows = staffGridFor(data, 110, AS_OF)
  assert.ok(!rows.some((r) => r.name === 'Starter'), 'a rotation arm is not pen availability')
  const cano = rows.find((r) => r.name === 'Cano')
  assert.equal(cano.cells.length, 8, 'seven spent columns, plus today')
  assert.equal(cano.cells.at(-1).today, true, 'today is the last cell and never spent')
  assert.equal(cano.cells.at(-1).pitches, null)
  assert.deepEqual(cano.runs, restRunsFor(cano.cells))
  assert.equal(cano.flags.length, TIRED_FLAGS.length)
})

// THE ROW'S CELLS MUST SUM TO THE NUMBER PRINTED BESIDE THEM. StaffGrid.jsx
// draws the strip and then `last7dayPitches` in the total column, so the strip
// has to span that metric's whole window — the seven COMPLETED days, asOf−7 to
// asOf−1. A seven-column strip ends on asOf and therefore starts at asOf−6,
// dropping the oldest day the total counts: Aroldis Chapman on 2026-08-31 drew
// a blank week beside a total of 18, because his only outing in the window
// landed on the day the strip had cut. Silent, and unarguable on screen —
// every number shown was real.
test('staffGridFor: the drawn cells sum to the total the row prints', () => {
  // Ortiz worked on asOf−7 and nowhere else, which is the exact cell a
  // seven-column strip loses.
  const edge = {
    asOf: AS_OF,
    baselines: data.baselines,
    pitchers: {
      ortiz: {
        name: 'Ortiz',
        teamId: 110,
        role: 'RP',
        season: { g: 30, gs: 0, pitches: 400, outs: 90, bf: 120, strikes: 260 },
        apps: [{ d: '2026-08-24', p: 18 }],
      },
    },
  }
  const [row] = staffGridFor(edge, 110, AS_OF)
  assert.equal(row.last7dayPitches, 18, 'asOf−7 is inside the seven-day window')
  assert.equal(
    row.cells.reduce((a, c) => a + (c.pitches ?? 0), 0),
    row.last7dayPitches,
    'a blank strip beside a non-zero total is the bug this pins',
  )

  // And it holds for every arm on a normally worked staff, not just the edge.
  for (const r of staffGridFor(data, 110, AS_OF)) {
    assert.equal(
      r.cells.reduce((a, c) => a + (c.pitches ?? 0), 0),
      r.last7dayPitches,
      `${r.name}'s strip must span the window his total counts`,
    )
  }
})

// THE MARK NAMES THE MAN IT DRAWS. The Pen prints the top row's threshold
// bullets under the top row's NAME (BullpenPage.jsx's PenRule), so a row's
// flags have to belong to that row's own pitcher and stay attached through
// compareArms' sort. Attaching a shared array, or reading the flags back by
// position after sorting, would draw one arm's bars beneath another arm's name
// — wrong, and silent, because every value on screen is still a real number.
// The grid test above only counts the flags; this one checks whose they are.
test('staffGridFor: every row draws its OWN flags, through the sort', () => {
  const idByName = { Cano: 'cano', Wilson: 'wilson', Nunez: 'nunez' }
  const rows = staffGridFor(data, 110, AS_OF)
  assert.ok(rows.length > 1, 'a one-row club could not tell a mix-up from a match')
  for (const r of rows) {
    assert.deepEqual(
      r.flags,
      tiredFlagsFor(data, idByName[r.name], AS_OF),
      `${r.name}'s row must carry ${r.name}'s own flags`,
    )
  }
})

// WHICH DATE A SURFACE ASKS ABOUT IS NOT COSMETIC. The file's appearances stop
// the day before its own `asOf`, so a surface that asks about a LATER day is
// asking about days the file holds nothing for — and "nothing" reads as rest.
// Every arm's yesterday measures zero and the board publishes an all-clear.
//
// This is why The Pen and the team hub's Bullpen health card both read
// `data.asOf` rather than the browser's today: on a night the cron ran the two
// strings are equal and it costs nothing, and on a night it slipped they still
// agree with each other instead of one saying limited and the other down.
test('a stale file read at the wrong date reports a false all-clear', () => {
  // Wilson threw 42 the day before AS_OF: two flags, so he is down.
  assert.equal(availabilityFor(data, 'wilson', AS_OF).status, 'down')

  // Asked about the day AFTER, that outing is no longer "yesterday" and the
  // file has nothing newer to put in its place.
  const dayLate = '2026-09-01'
  const by = Object.fromEntries(tiredFlagsFor(data, 'wilson', dayLate).map((f) => [f.key, f]))
  assert.equal(by.yesterday.value, 0, 'the file holds no appearance for that day')
  assert.equal(availabilityFor(data, 'wilson', dayLate).status, 'limited')

  // Same club, same file, one day apart: a different verdict on the board.
  assert.notDeepEqual(
    clubPenCounts(data, 110, AS_OF),
    clubPenCounts(data, 110, dayLate),
    'two surfaces reading this file at two dates would contradict each other',
  )
})

test('staffGridFor: an unknown club is null so the caller can hide the surface', () => {
  assert.equal(staffGridFor(data, 999, AS_OF), null)
  assert.equal(staffGridFor(null, 110, AS_OF), null)
})

test('clubPenCounts: tallies the same verdicts the grid shows', () => {
  const counts = clubPenCounts(data, 110, AS_OF)
  assert.deepEqual(counts, { fresh: 1, limited: 0, down: 2 })
  const rows = staffGridFor(data, 110, AS_OF)
  assert.equal(counts.fresh + counts.limited + counts.down, rows.length)
})

test('penDotsFrom: available first, so the leading run IS the reading', () => {
  assert.deepEqual(penDotsFrom({ fresh: 2, limited: 1, down: 1 }), [
    'fresh',
    'fresh',
    'limited',
    'down',
  ])
  // A club with no arms on file draws nothing rather than dead dots — that is a
  // gap in the file, not an empty bullpen.
  assert.equal(penDotsFrom({ fresh: 0, limited: 0, down: 0 }), null)
  assert.equal(penDotsFrom(null), null)
})
