// The Matchup Scout head-to-head data module (#1408, #1410): request builder,
// CSV parser, plate appearances, totals, and the one fetch.
//
// Fixtures are real Savant CSV, frozen with game_date_lt=2026-10-01 so a
// re-capture next season cannot change a count. Capture commands:
//
//   cap() { curl -sS -G https://baseballsavant.mlb.com/statcast_search/csv \
//     -d all=true -d type=details -d player_type=batter \
//     --data-urlencode 'hfGT=R|F|D|L|W|' \
//     --data-urlencode "batters_lookup[]=$1" --data-urlencode "pitchers_lookup[]=$2" \
//     -d game_date_lt=2026-10-01 -o "$3"; }
//   cap 592450 434378 test/fixtures/scout/judge-verlander.csv   # Judge vs Verlander
//   cap 592450 543037 test/fixtures/scout/judge-cole.csv        # Judge vs Cole
//
// vs-player-total.json is the statsapi cross-check (its own `_capture` note).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { baseballToday } from '../src/lib/time/standingsDates.js'
import {
  SAVANT_ROW_CAP,
  fetchHeadToHead,
  parseSavantRows,
  plateAppearances,
  savantUrl,
  totalsOf,
} from '../src/api/scout/headToHead.js'

const fixture = (name) => readFileSync(new URL(`./fixtures/scout/${name}`, import.meta.url), 'utf8')
const VERLANDER = fixture('judge-verlander.csv')
const COLE = fixture('judge-cole.csv')
const VS_TOTAL = JSON.parse(fixture('vs-player-total.json'))

// A synthetic Savant CSV: only the columns the module reads.
const COLS = 'game_pk,at_bat_number,game_date,game_type,events,des,plate_x,stand,p_throws,pitch_type,bb_type'
const csvRow = (o = {}) =>
  [
    o.game_pk ?? 1, o.at_bat_number ?? 1, o.game_date ?? '2025-04-08', o.game_type ?? 'R',
    o.events ?? '', o.des ?? '', o.plate_x ?? '0.1', o.stand ?? 'R', o.p_throws ?? 'L', o.pitch_type ?? '', o.bb_type ?? '',
  ].join(',')
// A `today` that clamps nothing, so these tests do not depend on the clock.
const FAR_FUTURE = '2099-01-01'
const csv = (...rows) => `${COLS}\n${rows.join('\n')}\n`

// --------------------------------------------------------------- request ----

test('savantUrl sends exactly the parameters #1410 lists, over HTTPS', () => {
  const u = new URL(savantUrl(592450, 434378, '2026-10-02', FAR_FUTURE))
  assert.equal(u.protocol, 'https:')
  assert.equal(u.host, 'baseballsavant.mlb.com')
  assert.equal(u.pathname, '/statcast_search/csv')
  const p = u.searchParams
  assert.deepEqual([...p.keys()].sort(), [
    'all', 'batters_lookup[]', 'game_date_lt', 'hfGT', 'pitchers_lookup[]', 'player_type', 'type',
  ])
  assert.equal(p.get('all'), 'true')
  assert.equal(p.get('type'), 'details')
  assert.equal(p.get('player_type'), 'batter')
  assert.equal(p.get('hfGT'), 'R|F|D|L|W|')
  assert.equal(p.get('batters_lookup[]'), '592450')
  assert.equal(p.get('pitchers_lookup[]'), '434378')
})

test('game_date_lt is the day BEFORE the cutoff, because Savant bounds are inclusive', () => {
  const lt = (cutoff) => new URL(savantUrl(1, 2, cutoff, FAR_FUTURE)).searchParams.get('game_date_lt')
  assert.equal(lt('2026-10-02'), '2026-10-01')
  assert.equal(lt('2026-03-01'), '2026-02-28') // month end
  assert.equal(lt('2024-03-01'), '2024-02-29') // leap year
  assert.equal(lt('2026-01-01'), '2025-12-31') // year end
})

test('the cutoff is clamped to today, so a future or same-day cutoff never reads a live game', () => {
  const lt = (cutoff) => new URL(savantUrl(1, 2, cutoff, '2026-10-02')).searchParams.get('game_date_lt')
  assert.equal(lt('2026-10-02'), '2026-10-01') // today: yesterday is the last day read
  assert.equal(lt('2026-12-01'), '2026-10-01') // a future ?d= clamps to today
  assert.equal(lt('2026-09-20'), '2026-09-19') // an earlier cutoff stands
})

// ----------------------------------------------------------------- parser ---

test('Judge vs Verlander parses to the 162 rows Savant returned', () => {
  assert.equal(parseSavantRows(VERLANDER).length, 162)
})

test('rows with no plate_x (pitch-clock rows) are not pitches', () => {
  const text = csv(
    csvRow({ plate_x: '0.5' }),
    csvRow({ plate_x: '' }), // automatic_ball / automatic_strike
    csvRow({ plate_x: '-1.2' }),
  )
  assert.equal(parseSavantRows(text).length, 2)
})

test('a pitch-clock row that ENDS a plate appearance is kept, but is not a pitch', () => {
  // Real rows, Savant 2026-09-20: 'automatic_strike' ended a strikeout and
  // 'automatic_ball' ended an intentional walk, both with no plate_x. Dropping
  // them lost the plate appearance from the list and from every total.
  const text = csv(
    csvRow({ at_bat_number: 7, plate_x: '0.2' }),
    csvRow({ at_bat_number: 7, plate_x: '', events: 'strikeout', des: 'Judge strikes out on automatic strike.' }),
    csvRow({ at_bat_number: 8, plate_x: '', events: 'intent_walk' }),
  )
  const pas = plateAppearances(parseSavantRows(text))
  assert.deepEqual(pas.map((p) => [p.atBat, p.event, p.pitches]).sort(), [[7, 'strikeout', 1], [8, 'intent_walk', 0]])
  const t = totalsOf(pas)
  assert.equal(t.pa, 2)
  assert.equal(t.k, 1)
  assert.equal(t.bb, 1)
})

test('a response at the 25,000-row cap throws, and counts rows BEFORE the skip', () => {
  const many = (n, plateX) => csv(...Array.from({ length: n }, () => csvRow({ plate_x: plateX })))
  assert.equal(SAVANT_ROW_CAP, 25000)
  assert.equal(parseSavantRows(many(SAVANT_ROW_CAP - 1, '0.1')).length, SAVANT_ROW_CAP - 1)
  assert.throws(() => parseSavantRows(many(SAVANT_ROW_CAP, '0.1')), /25000/)
  // Every row lacks plate_x: the skip would leave zero rows, and the cap still trips.
  assert.throws(() => parseSavantRows(many(SAVANT_ROW_CAP, '')), /25000/)
})

test('a header-only response is an empty list, not an error', () => {
  assert.deepEqual(parseSavantRows(`${COLS}\n`), [])
  assert.deepEqual(parseSavantRows(''), [])
})

// ------------------------------------------------------- plate appearances --

test('Judge vs Verlander: 41 plate appearances, 25 regular season and 16 LCS', () => {
  const pas = plateAppearances(parseSavantRows(VERLANDER))
  assert.equal(pas.length, 41)
  assert.equal(pas.filter((p) => p.round === 'R').length, 25)
  assert.equal(pas.filter((p) => p.round === 'L').length, 16)
  assert.equal(new Set(pas.map((p) => p.key)).size, 41)
  // Every row of the fixture belongs to one of the 41 plate appearances.
  assert.equal(pas.reduce((n, p) => n + p.pitches, 0), 162)
})

test('Judge vs Cole: 7 plate appearances, 3 regular season and 4 LCS', () => {
  const pas = plateAppearances(parseSavantRows(COLE))
  assert.equal(pas.length, 7)
  assert.equal(pas.filter((p) => p.round === 'R').length, 3)
  assert.equal(pas.filter((p) => p.round === 'L').length, 4)
  assert.equal(pas.find((p) => p.round === 'L').roundLabel, 'League Championship Series')
})

// The last pitch's type and the batted-ball type, from the event row. The design
// prints GO / FO / LO / PO for an out from bbType, and the pitch that ended it.
const tally = (pas, field) => {
  const t = {}
  for (const p of pas) t[p[field]] = (t[p[field]] ?? 0) + 1
  return t
}

test('Judge vs Verlander: the pitch type and batted-ball type of each plate appearance', () => {
  const pas = plateAppearances(parseSavantRows(VERLANDER))
  assert.deepEqual(tally(pas, 'pitchType'), { FF: 19, SL: 15, CU: 5, CH: 2 })
  assert.deepEqual(tally(pas, 'bbType'), { fly_ball: 12, ground_ball: 7, line_drive: 6, popup: 3, null: 13 })
  // The 13 with no batted ball are the 3 walks and 10 strikeouts.
  assert.deepEqual(
    [...new Set(pas.filter((p) => p.bbType === null).map((p) => p.event))].sort(),
    ['strikeout', 'walk'],
  )
})

test('Judge vs Cole: the pitch type and batted-ball type of each plate appearance', () => {
  const pas = plateAppearances(parseSavantRows(COLE))
  assert.deepEqual(tally(pas, 'pitchType'), { FF: 4, SL: 3 })
  assert.deepEqual(tally(pas, 'bbType'), { fly_ball: 1, ground_ball: 2, popup: 1, null: 3 })
})

test('a blank pitch_type or bb_type is null, never an empty string', () => {
  const [pa] = plateAppearances(parseSavantRows(csv(csvRow({ events: 'strikeout' }))))
  assert.equal(pa.pitchType, null)
  assert.equal(pa.bbType, null)
  const [hit] = plateAppearances(
    parseSavantRows(csv(csvRow({ events: 'field_out', pitch_type: 'CH', bb_type: 'popup' }))),
  )
  assert.equal(hit.pitchType, 'CH')
  assert.equal(hit.bbType, 'popup')
})

test('a plate appearance is keyed by game_pk + at_bat_number', () => {
  const rows = parseSavantRows(
    csv(
      csvRow({ game_pk: 10, at_bat_number: 3, events: 'single' }),
      csvRow({ game_pk: 10, at_bat_number: 3 }),
      csvRow({ game_pk: 10, at_bat_number: 4, events: 'walk' }),
      csvRow({ game_pk: 11, at_bat_number: 3, events: 'walk' }), // same at-bat number, other game
    ),
  )
  const pas = plateAppearances(rows)
  assert.deepEqual(pas.map((p) => p.key).sort(), ['10-3', '10-4', '11-3'])
  assert.equal(pas.find((p) => p.key === '10-3').pitches, 2)
})

test('round label comes from game_type', () => {
  const label = (g) =>
    plateAppearances(parseSavantRows(csv(csvRow({ game_type: g, events: 'single' }))))[0].roundLabel
  assert.equal(label('R'), 'Regular season')
  assert.equal(label('F'), 'Wild Card')
  assert.equal(label('D'), 'Division Series')
  assert.equal(label('L'), 'League Championship Series')
  assert.equal(label('W'), 'World Series')
})

test('truncated and baserunning-only events end no plate appearance', () => {
  // Savant stamps events=truncated_pa on a pitch that ends a cut-short at-bat
  // (4 of 4,265 rows on 2026-09-20, counts 0-0 to 0-1). The batter bats again
  // as a new at-bat, so it is not a PA. NON_PA_EVENT_TYPES is the feed's twin.
  const rows = parseSavantRows(
    csv(
      csvRow({ at_bat_number: 1, events: 'truncated_pa' }),
      csvRow({ at_bat_number: 2, events: 'caught_stealing_2b' }),
      csvRow({ at_bat_number: 3, events: 'strikeout' }),
    ),
  )
  assert.deepEqual(plateAppearances(rows).map((p) => p.event), ['strikeout'])
})

test('plate appearances come newest first', () => {
  const rows = parseSavantRows(
    csv(
      csvRow({ game_pk: 1, game_date: '2019-10-01', events: 'walk' }),
      csvRow({ game_pk: 3, game_date: '2024-10-14', at_bat_number: 2, events: 'walk' }),
      csvRow({ game_pk: 3, game_date: '2024-10-14', at_bat_number: 9, events: 'walk' }),
      csvRow({ game_pk: 2, game_date: '2023-04-02', events: 'walk' }),
    ),
  )
  assert.deepEqual(
    plateAppearances(rows).map((p) => p.key),
    ['3-9', '3-2', '2-1', '1-1'],
  )
})

test('a quoted description with commas survives into the plate appearance', () => {
  const rows = parseSavantRows(
    csv(csvRow({ events: 'single', des: '"Aaron Judge singles on a line drive to right fielder Zach McKinstry, Paul Goldschmidt to 2nd."' })),
  )
  assert.match(plateAppearances(rows)[0].description, /McKinstry, Paul/)
})

// ----------------------------------------------------------------- totals ---

const rate = (n, d) => (d ? n / d : null)

test('Judge vs Verlander totals', () => {
  const t = totalsOf(plateAppearances(parseSavantRows(VERLANDER)))
  assert.equal(t.pa, 41)
  assert.equal(t.ab, 38)
  assert.equal(t.h, 6)
  assert.equal(t.hr, 3)
  assert.equal(t.bb, 3)
  assert.equal(t.k, 10)
  assert.equal(t.tb, 15)
  assert.equal(t.avg, 6 / 38)
  assert.equal(t.obp, 9 / 41)
  assert.equal(t.slg, 15 / 38)
})

// The cross-check: statsapi vsPlayer, gameType=R,F,D,L,W. Its `vsPlayerTotal`
// entry holds one split per game type. The `vsPlayer` entry holds the same plate
// appearances again, split by season, so a sum over both doubles every count.
for (const [name, text, key] of [
  ['Judge vs Verlander', VERLANDER, 'verlander'],
  ['Judge vs Cole', COLE, 'cole'],
]) {
  test(`${name}: totals match statsapi vsPlayer, overall and per round`, () => {
    const pas = plateAppearances(parseSavantRows(text))
    const check = (mine, splits) => {
      const sum = (f) => splits.reduce((n, s) => n + s[f], 0)
      assert.equal(mine.pa, sum('plateAppearances'))
      assert.equal(mine.ab, sum('atBats'))
      assert.equal(mine.h, sum('hits'))
      assert.equal(mine.hr, sum('homeRuns'))
      assert.equal(mine.bb, sum('baseOnBalls'))
      assert.equal(mine.k, sum('strikeOuts'))
      assert.equal(mine.hbp, sum('hitByPitch'))
      assert.equal(mine.sf, sum('sacFlies'))
      assert.equal(mine.tb, sum('totalBases'))
      const obpDen = sum('atBats') + sum('baseOnBalls') + sum('hitByPitch') + sum('sacFlies')
      assert.equal(mine.avg, rate(sum('hits'), sum('atBats')))
      assert.equal(mine.obp, rate(sum('hits') + sum('baseOnBalls') + sum('hitByPitch'), obpDen))
      assert.equal(mine.slg, rate(sum('totalBases'), sum('atBats')))
    }
    check(totalsOf(pas), VS_TOTAL[key])
    for (const split of VS_TOTAL[key]) {
      check(totalsOf(pas.filter((p) => p.round === split.gameType)), [split])
    }
  })
}

test('totals of nothing: zero counts and null rates, never NaN', () => {
  const t = totalsOf([])
  assert.equal(t.pa, 0)
  assert.equal(t.avg, null)
  assert.equal(t.obp, null)
  assert.equal(t.slg, null)
})

test('totals classify walks, sacrifices, hit by pitch and total bases by rule', () => {
  const t = totalsOf(
    [
      'single', 'double', 'triple', 'home_run', // 4 AB, 4 H, 10 TB
      'walk', 'intent_walk', // 2 BB
      'hit_by_pitch', // 1 HBP
      'sac_fly', 'sac_fly_double_play', // 2 SF, no AB
      'sac_bunt', 'catcher_interf', // PA only
      'sac_bunt_double_play', // 9.08(c): charged an at-bat
      'strikeout', 'strikeout_double_play', // 2 K, 2 AB
      'field_out', 'grounded_into_double_play', 'force_out', 'field_error', 'fielders_choice', // 5 AB
    ].map((event) => ({ event })),
  )
  assert.equal(t.pa, 19)
  assert.equal(t.ab, 4 + 1 + 2 + 5)
  assert.equal(t.h, 4)
  assert.equal(t.tb, 10)
  assert.equal(t.hr, 1)
  assert.equal(t.bb, 2)
  assert.equal(t.hbp, 1)
  assert.equal(t.sf, 2)
  assert.equal(t.k, 2)
  assert.equal(t.obp, (4 + 2 + 1) / (12 + 2 + 1 + 2))
})

// ------------------------------------------------------------------ fetch ---

// Stub fetch and console.error for one test, always restoring both.
async function withStubs({ responses, run }) {
  const realFetch = globalThis.fetch
  const realError = console.error
  const calls = []
  const errors = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]
    if (next instanceof Error) throw next
    return next
  }
  console.error = (...args) => errors.push(args)
  try {
    return await run({ calls, errors })
  } finally {
    globalThis.fetch = realFetch
    console.error = realError
  }
}
const ok = (text) => new Response(text, { status: 200 })

test('fetchHeadToHead returns the plate appearances and totals, from one request', async () => {
  await withStubs({
    responses: [ok(VERLANDER)],
    run: async ({ calls }) => {
      const h2h = await fetchHeadToHead(592450, 434378, '2026-09-20')
      assert.equal(h2h.pas.length, 41)
      assert.equal(h2h.totals.pa, 41)
      assert.equal(calls.length, 1)
      assert.equal(new URL(calls[0]).searchParams.get('game_date_lt'), '2026-09-19')
    },
  })
})

test('fetchHeadToHead never sends a date on or after the baseball today', async () => {
  await withStubs({
    responses: [ok(`${COLS}\n`)],
    run: async ({ calls }) => {
      await fetchHeadToHead(1, 2, '2099-01-01')
      const lt = new URL(calls[0]).searchParams.get('game_date_lt')
      assert.ok(lt < baseballToday(), `${lt} is not before ${baseballToday()}`)
    },
  })
})

test('fetchHeadToHead retries once after a network failure', async () => {
  await withStubs({
    responses: [new TypeError('Failed to fetch'), ok(COLE)],
    run: async ({ calls }) => {
      const h2h = await fetchHeadToHead(592450, 543037, '2026-10-02')
      assert.equal(h2h.totals.pa, 7)
      assert.equal(calls.length, 2)
    },
  })
})

test('fetchHeadToHead returns null after the retry also fails, or on an HTTP error', async () => {
  await withStubs({
    responses: [new TypeError('Failed to fetch')],
    run: async ({ calls }) => {
      assert.equal(await fetchHeadToHead(1, 2, '2026-10-02'), null)
      assert.equal(calls.length, 2)
    },
  })
  await withStubs({
    responses: [new Response('', { status: 500 })],
    run: async ({ calls }) => {
      assert.equal(await fetchHeadToHead(1, 2, '2026-10-02'), null)
      assert.equal(calls.length, 2)
    },
  })
})

test('a capped response returns null, logs loudly, and is not retried', async () => {
  const capped = csv(...Array.from({ length: SAVANT_ROW_CAP }, () => csvRow()))
  await withStubs({
    responses: [ok(capped)],
    run: async ({ calls, errors }) => {
      assert.equal(await fetchHeadToHead(1, 2, '2026-10-02'), null)
      assert.equal(calls.length, 1)
      assert.equal(errors.length, 1)
      assert.match(String(errors[0][1]), /25000/)
    },
  })
})

test('a pair with no meetings is an empty head-to-head, not null', async () => {
  await withStubs({
    responses: [ok(`${COLS}\n`)],
    run: async () => {
      const h2h = await fetchHeadToHead(592450, 99999999, '2026-10-02')
      assert.deepEqual(h2h.pas, [])
      assert.equal(h2h.totals.pa, 0)
    },
  })
})

test('fetchHeadToHead returns null for a missing id or a garbled cutoff, without a request', async () => {
  await withStubs({
    responses: [ok(VERLANDER)],
    run: async ({ calls }) => {
      assert.equal(await fetchHeadToHead(null, 2, '2026-10-02'), null)
      assert.equal(await fetchHeadToHead(1, undefined, '2026-10-02'), null)
      assert.equal(await fetchHeadToHead(1, 2, 'not-a-date'), null)
      assert.equal(calls.length, 0)
    },
  })
})

// ------------------------------------------------------- pitch by pitch ----
// #1490: each plate appearance keeps its own pitches, for the Meetings tab.
// `pitches` stays the count (the shape above); the list is `pitchList`.

test('each plate appearance keeps its pitches in pitch_number order, with the fields the pitch modal reads', () => {
  const pas = plateAppearances(parseSavantRows(COLE))
  // Judge vs Cole, game 599359, at-bat 62: Savant sends it newest pitch first.
  const pa = pas.find((p) => p.key === '599359-62')
  assert.deepEqual(pa.pitchList.map((p) => [p.n, p.code, p.call]), [
    [1, 'FF', 'foul'],
    [2, 'FF', 'ball'],
    [3, 'KC', 'called_strike'],
    [4, 'SL', 'swinging_strike'],
  ])
  assert.equal(pa.inning, 7)
  assert.equal(pa.half, 'bottom')
  assert.equal(pa.stand, 'R')
  const last = pa.pitchList.at(-1)
  assert.equal(last.balls, 1)
  assert.equal(last.strikes, 2)
  assert.equal(last.release[1], 54.46)
  assert.equal(last.vy0, -132.414828221647)
  for (const key of ['mph', 'px', 'pz', 'szTop', 'szBot', 'spin', 'pfxX', 'pfxZ', 'vx0', 'vz0', 'ax', 'ay', 'az']) {
    assert.equal(typeof last[key], 'number', key)
  }
  // A strikeout puts no ball in play.
  assert.equal(last.launchSpeed, null)
  assert.equal(last.launchAngle, null)
})

test('the pitch count and the pitches list agree, and a pitch-clock row is never a pitch', () => {
  for (const pa of plateAppearances(parseSavantRows(VERLANDER))) assert.equal(pa.pitchList.length, pa.pitches)
  const text = csv(
    csvRow({ at_bat_number: 7, plate_x: '0.2' }),
    csvRow({ at_bat_number: 7, plate_x: '', events: 'strikeout' }),
  )
  const [pa] = plateAppearances(parseSavantRows(text))
  assert.equal(pa.pitches, 1)
  assert.deepEqual(pa.pitchList.map((p) => p.px), [0.2])
  assert.equal(totalsOf([pa]).pa, 1)
})

test('a ball in play carries its exit velocity, launch angle and xwOBA on contact; a blank is null', () => {
  const pas = plateAppearances(parseSavantRows(COLE))
  const inPlay = pas.flatMap((p) => p.pitchList).filter((p) => p.call === 'hit_into_play')
  assert.ok(inPlay.length > 0)
  for (const p of inPlay) {
    assert.equal(typeof p.launchSpeed, 'number')
    assert.equal(typeof p.launchAngle, 'number')
  }
  const [pa] = plateAppearances(parseSavantRows(csv(csvRow({ events: 'strikeout' }))))
  assert.equal(pa.pitchList[0].mph, null)
  assert.equal(pa.pitchList[0].launchSpeed, null)
  assert.equal(pa.inning, null)
})
