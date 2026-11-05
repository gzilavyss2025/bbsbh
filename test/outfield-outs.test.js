// THE KEPT-IT-IN-THE-INFIELD CLASSIFIER (issue #2976, data half). A team-game
// qualifies when its batting side made no out to an outfielder. These tests use
// trimmed real playByPlay responses (test/fixtures/outfield-outs/, fetched with
// the generator's own `fields=` list) and pin the rules the generator relies on.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVERAGE_MIN,
  coverageOk,
  gameIsScorable,
  outfieldOutsFor,
} from '../scripts/lib/outfield/outfield-outs.mjs'

const FIX = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'outfield-outs')
const load = (pk) => JSON.parse(readFileSync(join(FIX, `${pk}.json`), 'utf8')).allPlays ?? []

// A minimal play, built the way the trimmed feed builds one.
function pa({ eventType, batter = 1, credits = [], location = null }) {
  return {
    about: { halfInning: 'top' },
    matchup: { batter: { id: batter } },
    result: { type: 'atBat', eventType },
    runners: [{ details: { runner: { id: batter } }, credits: credits.map((code) => ({ position: { code: String(code) } })) }],
    playEvents: location == null ? [] : [{ hitData: { location: String(location) } }],
  }
}

// --- qualifier -------------------------------------------------------------

test('634393 Texas (top): no out to an outfielder, 8 OF hits; a home run is not one of them', () => {
  // Issue #2976's table: Texas Rangers 2021-04-25, 8 OF hits. Texas bats top
  // (away). Home runs are allowed and are not counted as OF hits (see the
  // classifier's header).
  const r = outfieldOutsFor(load(634393), 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.ofHits, 8)
  assert.ok(coverageOk(r.coverage), 'a full feed passes the coverage guard')
})

// --- negative --------------------------------------------------------------

test('717254 Cincinnati (top): a second qualifier from the issue table, 4 OF hits', () => {
  const r = outfieldOutsFor(load(717254), 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.ofHits, 4)
})

test('717254 Milwaukee (bottom): six outs to the outfield, so it is not a qualifier', () => {
  const r = outfieldOutsFor(load(717254), 'bottom')
  assert.equal(r.ofOuts, 6)
})

// --- the four rows that differ from the issue's table (PR body) ------------

test('716911 Philadelphia (bottom): a batter flied out to CF while a runner was doubled off first', () => {
  // The first credit on the play is the pitcher's, on the doubled-off runner.
  // The batter's own out is CF (8), an out to an outfielder. The issue's table
  // read the first credit and counted this team-game as a qualifier; the batter's
  // own credit decides, so this is NOT a qualifier (DECISION, the 716911 row).
  const r = outfieldOutsFor(load(716911), 'bottom')
  assert.equal(r.ofOuts, 1)
  assert.equal(r.ofHits, 11)
})

test('662057 Chicago (top): a field_error by the RF is not an out, so the team-game qualifies', () => {
  // The issue's table counted the error as an out and excluded the row. The
  // issue asks for field_error to be allowed; this is the gained row (DECISION).
  const r = outfieldOutsFor(load(662057), 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.ofHits, 2)
})

test('776694 Pittsburgh (bottom): a sac fly to CF is an out to an outfielder, not a qualifier', () => {
  // The batter's own credit is CF (8), so the sac fly is an OF out. The first
  // credit on the play is the catcher's throw on a runner at home, which the
  // issue's table read. This is the lost row (DECISION).
  const r = outfieldOutsFor(load(776694), 'bottom')
  assert.equal(r.ofOuts, 1)
})

// --- edge cases ------------------------------------------------------------

test('a field_error by an outfielder is neither an out nor an OF hit', () => {
  const r = outfieldOutsFor([pa({ eventType: 'field_error', credits: [8] })], 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.ofHits, 0)
})

test('a runner thrown out by an outfielder on a non-batted-ball play is ignored', () => {
  // Caught stealing: eventType is not a plate appearance, so it never counts.
  const cs = { about: { halfInning: 'top' }, matchup: { batter: { id: 2 } }, result: { type: 'atBat', eventType: 'caught_stealing_2b' },
    runners: [{ details: { runner: { id: 3 } }, credits: [{ position: { code: '9' } }] }], playEvents: [] }
  const r = outfieldOutsFor([cs], 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.plateAppearances, 0)
})

test('a ball deflected by an infielder and caught by an outfielder counts for the infielder (first credit wins)', () => {
  const r = outfieldOutsFor([pa({ eventType: 'field_out', credits: [6, 8] })], 'top')
  assert.equal(r.ofOuts, 0)
})

test('the other half of the inning is not counted for this batting side', () => {
  const r = outfieldOutsFor([{ ...pa({ eventType: 'field_out', credits: [8] }), about: { halfInning: 'bottom' } }], 'top')
  assert.equal(r.ofOuts, 0)
  assert.equal(r.plateAppearances, 0)
})

// --- empty-feed guard ------------------------------------------------------

test('632457 has no plate appearances in its playByPlay, so the game is not scorable', () => {
  // Marked Final in the schedule, but the feed is empty. Without this guard
  // both teams would count as qualifiers.
  const plays = load(632457)
  assert.equal(plays.length, 0)
  assert.equal(gameIsScorable(plays), false)
  assert.equal(outfieldOutsFor(plays, 'top').plateAppearances, 0)
})

// --- sparse-feed guard -----------------------------------------------------

test('823812 White Sox (top): all 9 balls in play carry a fielder, so the guard passes and the 0/0 stands', () => {
  // The issue reads hitData on 11 of 36 PAs as sparse. Those 11 are the 9 balls
  // in play plus 2 home runs; strikeouts and walks never carry hitData. Credits
  // name a fielder on every ball in play, so the guard does not fire here.
  // DECISION (PR body): 823812 top becomes a qualifier, a gained row.
  const r = outfieldOutsFor(load(823812), 'top')
  assert.deepEqual(r.coverage, { balls: 9, fielded: 9 })
  assert.equal(coverageOk(r.coverage), true)
  assert.equal(r.ofOuts, 0)
})

test('a feed whose balls in play lack fielders fails the guard (synthetic sparse feed)', () => {
  const plays = [
    pa({ eventType: 'field_out' }), pa({ eventType: 'single' }), pa({ eventType: 'field_out', credits: [6] }),
  ]
  const r = outfieldOutsFor(plays, 'top')
  assert.deepEqual(r.coverage, { balls: 3, fielded: 1 })
  assert.equal(coverageOk(r.coverage), false)
})

test('coverageOk refuses a team-game with fewer than the minimum share of balls in play fielded', () => {
  assert.equal(coverageOk({ balls: 10, fielded: 8 }), false)
  assert.equal(coverageOk({ balls: 10, fielded: 9 }), true)
  assert.equal(coverageOk({ balls: 0, fielded: 0 }), true)
})
