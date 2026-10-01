// A RECORDS LEDGER THAT HOLDS ONLY PART OF THE SEASON IS NOT SHOWN (#1363).
//
// The Numbers tab's Records card reads public/data/team-records/{season}/{id}.json.
// For the Dominican Summer League clubs (sportId 16) that file holds a small
// part of each season: DSL Brewers Blue (621) has 13 rows from 2026-07-02, and
// the live schedule has 60 final games from 2026-06-01 to 2026-08-18. Records
// built on that fraction say something false, so the decision on the issue
// is: hide them when the ledger is not complete. Do not backfill.
//
// The full-season levels are not perfect either: a few box scores never
// arrive, so a club at Double-A can be 127 of 132 (2026, checked live on
// 2026-10-01: 0-5 games short per club at MLB and the four MiLB levels). That
// small gap must not hide the card.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ledgerIsComplete } from '../src/api/teamRecords.js'

// Schedule rows the way fetchTeamSchedule gives them: `won` is null for a game
// not yet final or past the cutoff.
const sched = (dates) => dates.map((apiDate, i) => ({ gamePk: i + 1, apiDate, won: i % 2 === 0 }))
const ledger = (dates) => ({ games: dates.map((d) => ({ d, r: 'W', rs: 1, ra: 0 })) })
function days(from, n) {
  const out = []
  for (let i = 0; i < n; i++) out.push(new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10))
  return out
}

test('DSL Brewers Blue 2026: 13 rows against 60 final games is not complete', () => {
  const season = days('2026-06-01', 79).filter((_, i) => i % 4 !== 3).slice(0, 60) // 60 games, 06-01 on
  const rows = season.filter((d) => d >= '2026-07-02').slice(0, 13)
  assert.equal(ledgerIsComplete(ledger(rows), sched(season), '2026-09-30'), false)
})

test('a full-season club a few box scores short is still complete', () => {
  const season = days('2026-04-03', 132)
  const rows = season.filter((_, i) => ![10, 40, 70, 100, 120].includes(i)) // 127 of 132
  assert.equal(ledgerIsComplete(ledger(rows), sched(season), '2026-09-30'), true)
})

test('a ledger that lags the cutoff by the last two days is still complete', () => {
  // The nightly job runs before the day's games, so yesterday can be missing.
  const season = days('2026-04-01', 10)
  assert.equal(ledgerIsComplete(ledger(season.slice(0, 8)), sched(season), '2026-04-10'), true)
})

test('a ledger with every game is complete; games past the cutoff do not count', () => {
  const season = days('2026-04-01', 30)
  const visible = sched(season).map((g) => (g.apiDate > '2026-04-20' ? { ...g, won: null } : g))
  assert.equal(ledgerIsComplete(ledger(season), visible, '2026-04-20'), true)
  assert.equal(ledgerIsComplete(ledger(season.slice(0, 20)), visible, '2026-04-20'), true)
})

test('no ledger is not complete; no decided game yet is nothing to check', () => {
  assert.equal(ledgerIsComplete(null, sched(days('2026-04-01', 5)), '2026-04-10'), false)
  assert.equal(ledgerIsComplete(ledger([]), [], '2026-04-10'), true)
})

test('the Numbers tab drops an incomplete ledger before the card sees it', () => {
  const src = readFileSync(new URL('../src/screens/team/data/loadNumbers.js', import.meta.url), 'utf8')
  assert.match(src, /ledgerIsComplete\(teamRecordsData, schedule, /)
})
