// Unit coverage for the Stamp In page's pure rules (src/lib/stampIn.js).
//
// Three things are pinned here, and each one is load-bearing for a page that
// prints a whole season of final scores (ADR-0042):
//
//   1. The CONSENT predicate. It decides whether the season is drawn at all,
//      so it must fail CLOSED on anything stale, garbled or hand-edited —
//      the same posture isUnlocked takes in src/lib/scoresUnlocked.js.
//   2. The GAME list. Only games already played may appear (a scheduled game
//      has no result and nothing to stamp), newest first.
//   3. The BUTTON's state. Stamped, ready to press, or refused because the
//      season shard is full — the refusal is surfaced, never swallowed.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  STAMP_IN_CONSENT_KEY,
  hasStampInConsent,
  parseStampInConsent,
  serializeStampInConsent,
  stampButtonState,
  stampInGames,
} from '../src/lib/stampIn.js'

// --------------------------------------------------------------------------
// The consent record
// --------------------------------------------------------------------------
test('the consent key follows the house bbsbh: naming', () => {
  assert.equal(STAMP_IN_CONSENT_KEY, 'bbsbh:stampIn')
})

test('a consent record round-trips through serialize/parse', () => {
  const state = parseStampInConsent(serializeStampInConsent(1754600000000))
  assert.deepEqual(state, { consented: true, at: 1754600000000 })
  assert.equal(hasStampInConsent(state), true)
})

test('consent fails closed on anything malformed', () => {
  for (const raw of [
    null,
    undefined,
    '',
    'not json',
    '[]',
    '"yes"',
    '123',
    '{}',
    '{"consented":false}',
    '{"consented":"true"}',
    '{"consented":1}',
  ]) {
    assert.equal(parseStampInConsent(raw), null, JSON.stringify(raw))
    assert.equal(hasStampInConsent(parseStampInConsent(raw)), false, JSON.stringify(raw))
  }
})

test('a nonsense timestamp keeps the consent but zeroes the clock', () => {
  assert.deepEqual(parseStampInConsent('{"consented":true,"at":-5}'), {
    consented: true,
    at: 0,
  })
  assert.deepEqual(parseStampInConsent('{"consented":true,"at":"soon"}'), {
    consented: true,
    at: 0,
  })
})

test('hasStampInConsent answers false for any non-record', () => {
  for (const value of [null, undefined, {}, { consented: false }, 'true', 0]) {
    assert.equal(hasStampInConsent(value), false)
  }
})

// --------------------------------------------------------------------------
// The season list
// --------------------------------------------------------------------------
// fetchTeamSchedule's own shape (src/api/schedule.js): `won`/`runs`/`oppRuns`
// are null for anything not yet safe to show, which is exactly the "no result,
// nothing to stamp" case this filter exists to drop.
const SCHEDULE = [
  { gamePk: 1, apiDate: '2026-04-01', gameNumber: 1, won: true, runs: 5, oppRuns: 2 },
  { gamePk: 2, apiDate: '2026-04-02', gameNumber: 1, won: false, runs: 1, oppRuns: 4 },
  { gamePk: 3, apiDate: '2026-04-02', gameNumber: 2, won: true, runs: 3, oppRuns: 0 },
  { gamePk: 4, apiDate: '2026-09-30', gameNumber: 1, won: null, runs: null, oppRuns: null },
]

test('only games already played reach the page, newest first', () => {
  assert.deepEqual(
    stampInGames(SCHEDULE).map((g) => g.gamePk),
    [3, 2, 1],
  )
})

test('a doubleheader puts the later game above the earlier one', () => {
  // Same date, so gameNumber is the only thing left to order by — and "most
  // recent at the top" means game 2 leads game 1.
  const sameDay = stampInGames(SCHEDULE).filter((g) => g.apiDate === '2026-04-02')
  assert.deepEqual(sameDay.map((g) => g.gameNumber), [2, 1])
})

test('a tied/undecided final still counts as played when it carries a score', () => {
  // MiLB feeds degrade: a suspended-then-called game can end with runs on
  // both sides and no isWinner flag. It was played, so it can be stamped.
  const tie = [{ gamePk: 9, apiDate: '2026-05-05', gameNumber: 1, won: null, runs: 3, oppRuns: 3 }]
  assert.deepEqual(stampInGames(tie).map((g) => g.gamePk), [9])
})

test('a thin MiLB row with neither a result nor a score is dropped, not crashed on', () => {
  const thin = [
    { gamePk: 11, apiDate: '2026-05-05' },
    { gamePk: 12 },
    null,
    undefined,
  ]
  assert.deepEqual(stampInGames(thin), [])
})

test('stampInGames tolerates a missing schedule', () => {
  assert.deepEqual(stampInGames(null), [])
  assert.deepEqual(stampInGames(undefined), [])
  assert.deepEqual(stampInGames('nope'), [])
})

test('stampInGames does not mutate the schedule it is handed', () => {
  const input = SCHEDULE.slice()
  stampInGames(input)
  assert.deepEqual(input.map((g) => g.gamePk), [1, 2, 3, 4])
})

// --------------------------------------------------------------------------
// The button
// --------------------------------------------------------------------------
test('an unstamped game in a season with room is ready to press', () => {
  assert.equal(stampButtonState({ stamped: false, seasonFull: false }), 'ready')
})

test('a stamped game reads stamped, full season or not', () => {
  assert.equal(stampButtonState({ stamped: true, seasonFull: false }), 'stamped')
  // MAX_STAMPS_PER_SEASON refuses a NEW mint; it never takes one back, so a
  // stamp you already hold still reads as held.
  assert.equal(stampButtonState({ stamped: true, seasonFull: true }), 'stamped')
})

test('a full season refuses rather than silently doing nothing', () => {
  assert.equal(stampButtonState({ stamped: false, seasonFull: true }), 'full')
})

test('stampButtonState defaults to ready with no arguments', () => {
  assert.equal(stampButtonState(), 'ready')
})

// --------------------------------------------------------------------------
// Containment, asserted structurally
// --------------------------------------------------------------------------
function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (entry.endsWith('.js') || entry.endsWith('.jsx')) out.push(full)
  }
  return out
}

// Blank out comments so a file's own prose about what it must not do doesn't
// read as doing it — the same stripper check-stamp-surfaces.mjs uses, and for
// the same reason: StampInPage.jsx's header names every identifier below.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length))
}

// ADR-0042's first consequence: ONE entry point. These read the source rather
// than a value because that is where the property actually lives — a second
// link is added by editing a file, not by changing a number, and nothing else
// in the suite would notice.
test('the page never advances the reveal ratchet', () => {
  // The invariant with the widest blast radius (ADR-0042 §3): a write here
  // would unseal these games on every OTHER screen, and on every one of this
  // user's devices, permanently.
  const src = stripComments(
    readFileSync(new URL('../src/screens/team/StampInPage.jsx', import.meta.url), 'utf8'),
  )
  for (const forbidden of ['useRevealProgress', 'revealTo', 'onReveal', 'SealBox', 'bbsbh:reveal']) {
    assert.ok(!src.includes(forbidden), `StampInPage.jsx must not reference ${forbidden}`)
  }
})

test('the tab bar does not grow a sixth button for it', () => {
  const src = readFileSync(new URL('../src/screens/team/TeamTabBar.jsx', import.meta.url), 'utf8')
  assert.ok(!src.includes('stamp-in'), 'Stamp In is a standalone page, not a team-hub tab')
})

test('SeasonSchedule is the only file that links to the page', () => {
  // teamStampInPath is the one path builder for this route, so counting its
  // call sites counts the doors. Exactly two files may name it: the builder's
  // own home, and the single caller.
  const src = fileURLToPath(new URL('../src', import.meta.url))
  const named = sourceFiles(src)
    .filter((file) => readFileSync(file, 'utf8').includes('teamStampInPath'))
    .map((file) => file.slice(src.length + 1).replace(/\\/g, '/'))
    .sort()
  assert.deepEqual(named, ['lib/route.js', 'screens/team/modules/SeasonSchedule.jsx'])
})

test('the page is not in the site menu, the footers, or the report list', () => {
  const src = readFileSync(new URL('../src/lib/reportPages.js', import.meta.url), 'utf8')
  assert.ok(!src.includes('stamp-in'), 'Stamp In is club-scoped and deliberately unlisted')
})
