// Guards .scratch/team-success/roster-age-cache.json against losing a club
// stint. That file stores one row per player per club stint and is the
// authority eight other scripts read to decide WHICH CLUB a player's playing
// time belongs to — payroll attribution, dead money, postseason experience and
// the star/recognition diversity panels all join through it.
//
// THE FAILURE THIS EXISTS FOR. statsapi's club-filtered player pull
// (stats=season&teamId=...) dropped the SELLING club's stint for the 2024 and
// 2025 seasons: a player traded in July appeared only under the club that
// acquired him, and the club that gave him up simply had no row. Nothing in the
// file looked wrong. The remaining rows still read as a roster, the weights
// were still per-stint and correct, and the generator's own cache made a rerun
// a no-op that reported success. Carlos Correa's 364 plate appearances for
// Minnesota in 2025 were absent for months.
//
// The loss is only visible when the stints are ADDED UP and compared to what
// the club says its own season was. fixtures/roster-age-club-totals.json holds
// that number for every club, season and group, captured from
// /api/v1/teams/{id}/stats by .scratch/team-success/capture-club-totals.mjs, so
// the comparison runs offline here.
//
// IF THIS FAILS, the cache lost rows — do not recapture the fixture to get
// green. Rebuild the affected seasons with
// `node .scratch/team-success/build-roster-age.mjs --refetch=YYYY`, which
// restores the missing stints from the per-player yearByYear endpoint and
// refuses to write a club that does not reconcile. Recapture the fixture only
// when a season is ADDED, and read the diff first: a number that moves for a
// closed season is statsapi restating history.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...parts) => JSON.parse(readFileSync(join(__dirname, ...parts), 'utf8'))

const cache = read('..', '.scratch', 'team-success', 'roster-age-cache.json')
const clubTotals = read('fixtures', 'roster-age-club-totals.json')

// Innings pitched carry thirds, so the comparison is to the last third of an
// inning rather than to the last bit.
const TOLERANCE = 0.01

function sumWeight(rows) {
  let sum = 0
  for (const row of rows ?? []) if (Number.isFinite(row.weight)) sum += row.weight
  return sum
}

// Which clubs hold a row for this player in this season — the set that goes
// short by one when a stint is dropped.
function clubsFor(personId, season, group) {
  return Object.entries(cache)
    .filter(([key]) => key.startsWith(`${group}-`) && key.endsWith(`-${season}`))
    .filter(([, rows]) => rows.some((row) => row.personId === personId))
    .map(([key]) => Number(key.split('-')[1]))
    .sort((a, b) => a - b)
}

test('the cache covers exactly the club-season-groups the fixture does', () => {
  assert.equal(Object.keys(cache).length, Object.keys(clubTotals).length)
  const missing = Object.keys(clubTotals).filter((key) => !Array.isArray(cache[key]))
  assert.deepEqual(missing, [])
})

test("each club's stints add up to the club's own season total", () => {
  const short = []
  for (const [key, clubTotal] of Object.entries(clubTotals)) {
    const summed = sumWeight(cache[key])
    if (Math.abs(summed - clubTotal) > TOLERANCE) {
      short.push(`${key}: stints add to ${summed}, the club reports ${clubTotal}`)
    }
  }
  assert.deepEqual(short, [])
})

test('a player traded mid-season keeps a row under BOTH clubs', () => {
  // Carlos Correa, Minnesota -> Houston at the 2025 deadline. Only the Houston
  // row survived the bad pull.
  assert.deepEqual(clubsFor(621043, 2025, 'hitting'), [117, 142])
  // Rafael Devers, Boston -> San Francisco, June 2025. Only San Francisco
  // survived.
  assert.deepEqual(clubsFor(646240, 2025, 'hitting'), [111, 137])
  // The same season read correctly before the defect appeared, as the control.
  assert.deepEqual(clubsFor(621043, 2023, 'hitting'), [142])
})
