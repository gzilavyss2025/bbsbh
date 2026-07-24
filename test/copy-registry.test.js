// Unit coverage for the copy registry (src/copy/registry.js) — the closed set
// of admin-editable UI strings. These tests pin the safety properties the
// admin panel and api/copy.js both lean on: a stored/POSTed override map can
// only ever set a KNOWN id to an in-budget string, everything resolves to a
// renderable default, and the one honored token substitutes correctly. If any
// of these loosen, untrusted copy could inject an unknown key or an oversized
// value into a consent modal.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FIELDS,
  FIELD_IDS,
  defaultCopy,
  fillTokens,
  resolveCopy,
  sanitizeOverrides,
} from '../src/copy/registry.js'

test('every field has a non-empty default within its own maxLength', () => {
  for (const f of FIELDS) {
    assert.equal(typeof f.default, 'string', `${f.id} default is a string`)
    assert.ok(f.default.length > 0, `${f.id} default is non-empty`)
    assert.ok(f.default.length <= f.maxLength, `${f.id} default fits its maxLength`)
  }
})

// The in-game Scores Unlocked override reveals real scores, so the default
// consent copy must be HONEST that turning the pass on does not track or advance
// your by-hand scoring — it only shows today's numbers, then re-seals. (ADR-0026)
test('scoresUnlocked consent body is honest that hand-scoring is not tracked', () => {
  const body = defaultCopy()['scoresUnlocked.body']
  assert.match(body, /\b(track|advance|tracked|advanced)\b/i)
})

// Both the slate and in-game consent must promise that regardless of what the
// user does, the 8am reset returns the app to sealed-by-default — and name the
// exact time via the one honored {time} token.
test('scoresUnlocked resetNote promises an unconditional 8am re-seal with {time}', () => {
  const note = defaultCopy()['scoresUnlocked.resetNote']
  assert.match(note, /no matter what|regardless/i)
  assert.match(note, /\{time\}/)
})

test('field ids are unique and dotted group.slot', () => {
  const seen = new Set()
  for (const id of FIELD_IDS) {
    assert.ok(!seen.has(id), `${id} is unique`)
    seen.add(id)
    assert.match(id, /^[a-zA-Z]+\.[a-zA-Z]+$/, `${id} is group.slot`)
  }
})

test('defaultCopy maps every field id to its default', () => {
  const map = defaultCopy()
  assert.equal(Object.keys(map).length, FIELDS.length)
  for (const f of FIELDS) assert.equal(map[f.id], f.default)
})

test('sanitizeOverrides drops unknown ids', () => {
  const out = sanitizeOverrides({ 'not.a.real.key': 'x', evil: 'y' })
  assert.deepEqual(out, {})
})

test('sanitizeOverrides keeps a known id with an in-budget string', () => {
  const out = sanitizeOverrides({ 'followLive.title': 'Watch it live?' })
  assert.deepEqual(out, { 'followLive.title': 'Watch it live?' })
})

test('sanitizeOverrides drops a value over the field maxLength', () => {
  const field = FIELDS.find((f) => f.id === 'scoresUnlocked.title')
  const tooLong = 'x'.repeat(field.maxLength + 1)
  assert.deepEqual(sanitizeOverrides({ 'scoresUnlocked.title': tooLong }), {})
})

test('sanitizeOverrides keeps a value exactly at the maxLength boundary', () => {
  const field = FIELDS.find((f) => f.id === 'scoresUnlocked.title')
  const exact = 'x'.repeat(field.maxLength)
  assert.deepEqual(sanitizeOverrides({ 'scoresUnlocked.title': exact }), {
    'scoresUnlocked.title': exact,
  })
})

test('sanitizeOverrides drops non-string and empty/whitespace values', () => {
  const out = sanitizeOverrides({
    'followLive.title': 42,
    'followLive.body': '',
    'followLive.humorLine': '   ',
    'followLive.banner': null,
  })
  assert.deepEqual(out, {})
})

test('sanitizeOverrides trims trailing whitespace but keeps leading', () => {
  const out = sanitizeOverrides({ 'followLive.banner': '  Following live   ' })
  assert.equal(out['followLive.banner'], '  Following live')
})

test('sanitizeOverrides tolerates garbage input without throwing', () => {
  assert.deepEqual(sanitizeOverrides(null), {})
  assert.deepEqual(sanitizeOverrides(undefined), {})
  assert.deepEqual(sanitizeOverrides('a string'), {})
  assert.deepEqual(sanitizeOverrides(123), {})
})

test('sanitizeOverrides strips bidi-override and control characters', () => {
  // A right-to-left override (U+202E) embedded in a button label must not survive.
  const out = sanitizeOverrides({ 'scoresUnlocked.confirm': 'Show ‮scores' })
  assert.equal(out['scoresUnlocked.confirm'], 'Show scores')
})

test('sanitizeOverrides drops newlines in a single-line field but keeps them multiline', () => {
  // followLive.confirm is single-line; followLive.body is multiline.
  const single = sanitizeOverrides({ 'followLive.confirm': 'Follow\nlive' })
  assert.equal(single['followLive.confirm'], 'Followlive')
  const multi = sanitizeOverrides({ 'followLive.body': 'line one\nline two' })
  assert.equal(multi['followLive.body'], 'line one\nline two')
})

test('resolveCopy layers valid overrides over defaults and ignores junk', () => {
  const resolved = resolveCopy({
    'scoresUnlocked.title': 'Custom title',
    'unknown.key': 'ignored',
  })
  assert.equal(resolved['scoresUnlocked.title'], 'Custom title')
  // An untouched field still resolves to its default.
  const untouched = FIELDS.find((f) => f.id !== 'scoresUnlocked.title')
  assert.equal(resolved[untouched.id], untouched.default)
  assert.equal(resolved['unknown.key'], undefined)
})

test('fillTokens substitutes {time} when provided', () => {
  assert.equal(fillTokens('Scores until {time}', { time: '8:00 AM' }), 'Scores until 8:00 AM')
})

test('fillTokens strips {time} and tidies the gap when no time is given', () => {
  // Trailing token -> no dangling space.
  assert.equal(fillTokens('Scores until {time}'), 'Scores until')
  assert.equal(fillTokens('Scores until {time}', {}), 'Scores until')
  // Mid-sentence token -> collapsed, no double space, punctuation kept tight.
  assert.equal(fillTokens('By {time} the app re-seals.'), 'By the app re-seals.')
  assert.equal(fillTokens('reset at {time}, always'), 'reset at, always')
})

test('fillTokens uses function-form replacement so $-patterns in time are literal', () => {
  assert.equal(fillTokens('at {time}', { time: '$& $`' }), 'at $& $`')
})

test('fillTokens leaves token-free text unchanged and handles non-strings', () => {
  assert.equal(fillTokens('no token here', { time: '8:00 AM' }), 'no token here')
  assert.equal(fillTokens(null), '')
  assert.equal(fillTokens(undefined, { time: '8:00 AM' }), '')
})
