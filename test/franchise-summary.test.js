import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// #2600: the franchise summary, derived from the season ledger (#2595) and the pennants file.
// A fetch stub serves /data/ from public/data, so the reader runs on the real files.
globalThis.fetch = async (url) => {
  try {
    const body = readFileSync(new URL(`../public${url}`, import.meta.url), 'utf8')
    return { ok: true, status: 200, headers: new Headers(), json: async () => JSON.parse(body), text: async () => body }
  } catch {
    return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' }
  }
}
const { summarizeFranchise } = await import('../src/api/history/franchiseSummary.js')
const { franchiseLedger } = await import('../src/api/history/franchiseLedger.js')
const { pennantsFor } = await import('../src/api/history/leaguePennants.js')

// The real files through the pure summary, as the franchise page reads them (its live rows aside).
async function franchiseSummary(id) {
  const { through, rows } = await franchiseLedger(id)
  return { through, ...summarizeFranchise(rows, await pennantsFor(id)) }
}

const row = (season, name, w, l, managers = [], postseason = null) => ({ season, name, w, l, managers, postseason })

test('summarizeFranchise: names as runs in order, seasons, and the record summed over rows', () => {
  const s = summarizeFranchise(
    [row(1969, 'Seattle Pilots', 64, 98), row(1970, 'Milwaukee Brewers', 65, 97), row(1971, 'Milwaukee Brewers', 69, 92)],
    [],
  )
  assert.deepEqual(s.names, [
    { name: 'Seattle Pilots', from: 1969, to: 1969 },
    { name: 'Milwaukee Brewers', from: 1970, to: 1971 },
  ])
  assert.deepEqual(s.seasons, { from: 1969, to: 1971, count: 3 })
  assert.deepEqual(s.record, { w: 198, l: 287 })
})

test('summarizeFranchise: a name the club returns to is a second run', () => {
  const s = summarizeFranchise([row(1, 'A', 1, 0), row(2, 'B', 1, 0), row(3, 'A', 1, 0)], [])
  assert.deepEqual(s.names.map((n) => [n.name, n.from, n.to]), [['A', 1, 1], ['B', 2, 2], ['A', 3, 3]])
})

test('summarizeFranchise: postseasons are the seasons with a result; titles are World Series won', () => {
  const s = summarizeFranchise(
    [
      row(1981, 'X', 62, 47, [], { round: 'AL Division Series', won: false }),
      row(1982, 'X', 95, 67, [], { round: 'World Series', won: false }),
      row(1983, 'X', 87, 75),
      row(1984, 'X', 90, 72, [], { round: 'World Series', won: true }),
    ],
    [],
  )
  assert.deepEqual(s.postseasons, [1981, 1982, 1984])
  assert.deepEqual(s.titles, [1984])
})

test('summarizeFranchise: pennants pass through as given', () => {
  const p = [{ season: 1982, teamId: 158 }]
  assert.equal(summarizeFranchise([row(1982, 'X', 95, 67)], p).pennants, p)
})

test('winningest manager: sole-manager seasons only; a shared season (no w/l) is not counted', () => {
  const s = summarizeFranchise(
    [
      row(2015, 'X', 68, 94, [{ id: 1, name: 'Counsell' }, { id: 2, name: 'Roenicke' }]),
      row(2016, 'X', 73, 89, [{ id: 1, name: 'Counsell', w: 73, l: 89 }]),
      row(2017, 'X', 86, 76, [{ id: 1, name: 'Counsell', w: 86, l: 76 }]),
      row(2014, 'X', 82, 80, [{ id: 2, name: 'Roenicke', w: 82, l: 80 }]),
    ],
    [],
  )
  assert.deepEqual(s.winningestManager, { id: 1, name: 'Counsell', w: 159, l: 165, seasons: 2 })
  assert.equal(s.managersFrom, 2014)
})

test('winningest manager: equal wins go to fewer losses; no manager data reads null', () => {
  const s = summarizeFranchise(
    [row(1, 'X', 90, 72, [{ id: 5, name: 'A', w: 90, l: 72 }]), row(2, 'X', 90, 70, [{ id: 6, name: 'B', w: 90, l: 70 }])],
    [],
  )
  assert.equal(s.winningestManager.name, 'B')
  const none = summarizeFranchise([row(1950, 'X', 80, 74)], [])
  assert.equal(none.winningestManager, null)
  assert.equal(none.managersFrom, null)
})

test('summarizeFranchise: managers, one entry each with every season he is listed in and whether a split is missing', () => {
  const s = summarizeFranchise(
    [row(2014, 'B', 82, 80, [{ id: 1, name: 'Ron', w: 82, l: 80 }]), row(2015, 'B', 68, 94, [{ id: 2, name: 'Craig', w: 61, l: 76 }, { id: 1, name: 'Ron' }])],
    [],
  )
  assert.deepEqual(s.managers, [
    { id: 1, name: 'Ron', w: 82, l: 80, seasons: 1, years: [2014, 2015], partial: true },
    { id: 2, name: 'Craig', w: 61, l: 76, seasons: 1, years: [2015], partial: false },
  ])
})

test('summarizeFranchise: no rows reads empty, not a crash', () => {
  const s = summarizeFranchise([], [])
  assert.deepEqual(s.names, [])
  assert.equal(s.seasons, null)
  assert.deepEqual(s.record, { w: 0, l: 0 })
})

test('franchiseSummary(158): Pilots then Brewers from 1969, record is the ledger sum, pennants are pennantsFor', async () => {
  const s = await franchiseSummary(158)
  const { rows, through } = await franchiseLedger(158)
  assert.deepEqual(s.names.map((n) => n.name), ['Seattle Pilots', 'Milwaukee Brewers'])
  assert.equal(s.seasons.from, 1969)
  assert.equal(s.seasons.to, through)
  assert.equal(s.through, through)
  assert.deepEqual(s.record, { w: rows.reduce((t, r) => t + r.w, 0), l: rows.reduce((t, r) => t + r.l, 0) })
  assert.deepEqual(s.pennants, await pennantsFor(158))
})

test('franchiseSummary(158): the 1982 Brewers lost the World Series, so no title; 11 postseasons through 2025', async () => {
  const s = await franchiseSummary(158)
  assert.deepEqual(s.titles, [])
  assert.ok(s.postseasons.includes(1982))
  assert.deepEqual(s.postseasons, [1981, 1982, 2008, 2011, 2018, 2019, 2020, 2021, 2023, 2024, 2025])
})

test('franchiseSummary(158): the winningest manager is Craig Counsell, 707-625, the same as B-R', async () => {
  // 2015 is split at 2015-05-04 (manager-transitions-seed.json): Roenicke 7-18, Counsell 61-76.
  const s = await franchiseSummary(158)
  assert.deepEqual(s.winningestManager, { id: 112736, name: 'Craig Counsell', w: 707, l: 625, seasons: 9 })
  assert.equal(s.managersFrom, 1969)
})

test('franchiseSummary(147): titles come from the ledger; 1996 and 2009 are among them', async () => {
  const s = await franchiseSummary(147)
  assert.ok(s.titles.includes(1996) && s.titles.includes(2009))
  assert.ok(!s.titles.includes(2001)) // lost the 2001 World Series
})

test('franchiseSummary: a MiLB id reads empty', async () => {
  const s = await franchiseSummary(4124)
  assert.deepEqual(s.names, [])
  assert.equal(s.winningestManager, null)
})
