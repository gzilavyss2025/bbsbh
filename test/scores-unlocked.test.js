// Unit coverage for lib/scoresUnlocked.js — the 8am-local day-pass math behind
// the site-wide "Scores Unlocked" toggle. The safety-critical properties: the
// expiry always lands on the next local 8:00, "unlocked" fails closed on any
// garbage/past/over-window value, and the reset is always within a sane window.
// Assertions are written against LOCAL wall-clock (getHours) and constructed
// from local Dates, so they hold regardless of the runner's timezone.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_WINDOW_MS,
  RESET_HOUR,
  formatResetTime,
  isUnlocked,
  msUntilReset,
  nextResetAt,
} from '../src/lib/scoresUnlocked.js'

// nextResetAt --------------------------------------------------------------

test('nextResetAt always lands on the local reset hour, at :00', () => {
  const now = new Date(2026, 6, 24, 20, 30, 0) // 8:30pm local
  const e = new Date(nextResetAt(now))
  assert.equal(e.getHours(), RESET_HOUR)
  assert.equal(e.getMinutes(), 0)
  assert.equal(e.getSeconds(), 0)
})

test('evening enable rolls to the NEXT morning', () => {
  const now = new Date(2026, 6, 24, 20, 0, 0) // 8pm Jul 24
  const e = new Date(nextResetAt(now))
  assert.equal(e.getDate(), 25) // Jul 25
  assert.ok(e.getTime() > now.getTime())
})

test('early-morning enable (before 8am) resets the SAME day', () => {
  const now = new Date(2026, 6, 24, 7, 30, 0) // 7:30am Jul 24
  const e = new Date(nextResetAt(now))
  assert.equal(e.getDate(), 24)
  assert.ok(e.getTime() > now.getTime())
})

test('exactly at the reset hour rolls to the next day (strictly after now)', () => {
  const now = new Date(2026, 6, 24, 8, 0, 0) // 8:00:00am exactly
  const e = new Date(nextResetAt(now))
  assert.equal(e.getDate(), 25)
})

test('nextResetAt is always within the sane window of now', () => {
  for (const hour of [0, 7, 8, 9, 12, 20, 23]) {
    const now = new Date(2026, 6, 24, hour, 15, 0)
    const delta = nextResetAt(now) - now.getTime()
    assert.ok(delta > 0, `hour ${hour}: strictly future`)
    assert.ok(delta <= MAX_WINDOW_MS, `hour ${hour}: within window`)
  }
})

// isUnlocked ---------------------------------------------------------------

test('isUnlocked is true for a live in-window expiry', () => {
  const now = Date.now()
  assert.equal(isUnlocked(now + 3 * 3600 * 1000, now), true)
})

test('isUnlocked fails closed on a past expiry', () => {
  const now = Date.now()
  assert.equal(isUnlocked(now - 1000, now), false)
})

test('isUnlocked fails closed on an over-window (far-future) expiry', () => {
  const now = Date.now()
  assert.equal(isUnlocked(now + MAX_WINDOW_MS + 1000, now), false)
})

test('isUnlocked fails closed on garbage', () => {
  const now = Date.now()
  assert.equal(isUnlocked(null, now), false)
  assert.equal(isUnlocked(undefined, now), false)
  assert.equal(isUnlocked('not a number', now), false)
  assert.equal(isUnlocked(NaN, now), false)
  assert.equal(isUnlocked('', now), false)
})

test('isUnlocked accepts a numeric string (localStorage always stringifies)', () => {
  const now = Date.now()
  assert.equal(isUnlocked(String(now + 3600 * 1000), now), true)
})

// msUntilReset -------------------------------------------------------------

test('msUntilReset returns the remaining ms for a live expiry', () => {
  const now = Date.now()
  assert.equal(msUntilReset(now + 5000, now), 5000)
})

test('msUntilReset returns null when not unlocked', () => {
  const now = Date.now()
  assert.equal(msUntilReset(now - 5000, now), null)
  assert.equal(msUntilReset('junk', now), null)
})

// formatResetTime ----------------------------------------------------------

test('formatResetTime yields a non-empty clock string for a valid expiry', () => {
  const s = formatResetTime(new Date(2026, 6, 24, 8, 0, 0).getTime())
  assert.equal(typeof s, 'string')
  assert.ok(s.length > 0)
})

test('formatResetTime is empty for garbage', () => {
  assert.equal(formatResetTime('nope'), '')
  assert.equal(formatResetTime(null), '')
})

// DST ----------------------------------------------------------------------
// The module comment justifies MAX_WINDOW_MS = 26h by "a DST fall-back night is
// 25 wall-clock hours." The runner's own TZ (UTC in CI) has no DST, so we prove
// it in a child Node process pinned to a US zone. This is the case that would
// break a naive 24h clamp.
const TZ = 'America/New_York'

// Whether the runner actually has IANA tzdata for our test zone. A minimal
// container without tzdata silently falls back to UTC (no DST), which would make
// the assertions below fail on a CORRECT implementation. Probe once and skip
// rather than red-fail in that environment.
function zoneObservesDst(tz) {
  try {
    const jan = new Date(2026, 0, 1).toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' })
    const jul = new Date(2026, 6, 1).toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' })
    // EST in January vs EDT in July only if tzdata is present.
    return jan.includes('EST') && jul.includes('EDT')
  } catch {
    return false
  }
}
const DST_AVAILABLE = zoneObservesDst(TZ)
const dstSkip = DST_AVAILABLE ? false : `IANA tzdata for ${TZ} unavailable on this runner`

function windowHoursIn(tz, y, monthIndex, day, hour) {
  const modUrl = new URL('../src/lib/scoresUnlocked.js', import.meta.url).href
  const code = `
    const { nextResetAt } = await import(${JSON.stringify(modUrl)});
    const now = new Date(${y}, ${monthIndex}, ${day}, ${hour}, 0, 1);
    process.stdout.write(String(nextResetAt(now) - now.getTime()));
  `
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  })
  return Number(out) / 3_600_000
}

test('DST fall-back night: 8am→8am spans ~25h and stays within MAX_WINDOW', { skip: dstSkip }, () => {
  // US fall-back 2026: Sun Nov 1, 2:00am → 1:00am. now = Oct 31 8:00:01 local.
  const h = windowHoursIn(TZ, 2026, 9, 31, 8)
  assert.ok(Math.abs(h - 25) < 0.01, `expected ~25h, got ${h}`)
  assert.ok(h * 3_600_000 <= MAX_WINDOW_MS, '25h night must fit the 26h clamp')
})

test('DST spring-forward night: 8am→8am spans ~23h', { skip: dstSkip }, () => {
  // US spring-forward 2026: Sun Mar 8, 2:00am → 3:00am. now = Mar 7 8:00:01 local.
  const h = windowHoursIn(TZ, 2026, 2, 7, 8)
  assert.ok(Math.abs(h - 23) < 0.01, `expected ~23h, got ${h}`)
})
