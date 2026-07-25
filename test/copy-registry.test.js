// Unit coverage for the copy registry (src/copy/registry.js) — the closed set
// of admin-editable UI strings. These tests pin the safety properties the
// admin panel and api/copy.js both lean on: a stored/POSTed override map can
// only ever set a KNOWN id to an in-budget string, everything resolves to a
// renderable default, and the closed set of honored tokens substitutes
// correctly. If any of these loosen, untrusted copy could inject an unknown key
// or an oversized value into a consent modal.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FIELDS,
  FIELD_IDS,
  TOKENS,
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

// The pass reveals real scores everywhere, so the default consent copy must be
// HONEST about the one thing it leaves alone: your by-hand scoring. Nothing the
// pass shows is ever recorded as scored, on this device or any other — that is
// what effectiveReveal's `commitReveals` enforces in code, and the copy has to
// say it. (ADR-0026)
test('scoresUnlocked consent copy is honest that hand-scoring is left alone', () => {
  const copy = defaultCopy()
  const said = `${copy['scoresUnlocked.body']} ${copy['scoresUnlocked.changesNote']}`
  assert.match(said, /\b(scoring|scored)\b/i)
  assert.match(said, /\b(leaves .* alone|does not track|not tracked|left alone)\b/i)
})

// The consent must name what 8am actually does, and it is NOT "everything
// re-seals" — that would be a lie, since a day you consented to stays unlocked
// (spoiledDays.js). It must say the switch turns itself off so the NEXT day is
// sealed, must be honest that today stays open, and must name the exact time via
// the {time} token.
test('scoresUnlocked resetNote is honest about what 8am does', () => {
  const note = defaultCopy()['scoresUnlocked.resetNote']
  assert.match(note, /\{time\}/)
  // Tomorrow re-seals...
  assert.match(note, /tomorrow|next day/i)
  // ...and today does not. The promise the old copy made ("no matter what, it
  // all re-seals") must never come back — it stopped being true.
  assert.match(note, /today stays|stays unlocked|stays open/i)
  assert.doesNotMatch(note, /re-seals on its own/i)
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
  const out = sanitizeOverrides({ 'scoresUnlocked.title': 'Show me everything?' })
  assert.deepEqual(out, { 'scoresUnlocked.title': 'Show me everything?' })
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
    'scoresUnlocked.title': 42,
    'scoresUnlocked.body': '',
    'scoresUnlocked.humorLine': '   ',
    'scoresUnlocked.banner': null,
  })
  assert.deepEqual(out, {})
})

test('sanitizeOverrides trims trailing whitespace but keeps leading', () => {
  const out = sanitizeOverrides({ 'scoresUnlocked.banner': '  Scores unlocked   ' })
  assert.equal(out['scoresUnlocked.banner'], '  Scores unlocked')
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
  // scoresUnlocked.confirm is single-line; scoresUnlocked.body is multiline.
  const single = sanitizeOverrides({ 'scoresUnlocked.confirm': 'Show\nscores' })
  assert.equal(single['scoresUnlocked.confirm'], 'Showscores')
  const multi = sanitizeOverrides({ 'scoresUnlocked.body': 'line one\nline two' })
  assert.equal(multi['scoresUnlocked.body'], 'line one\nline two')
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

// {inning} is the second honored token (registry TOKENS). It goes through the
// SAME choke point as {time} rather than an ad hoc replace at the call site, so
// an admin who drops it gets the gap tidied like every other field.
test('fillTokens substitutes {inning} and tidies it away when absent', () => {
  assert.equal(
    fillTokens('Live · {inning} in progress', { inning: 'Top 7th' }),
    'Live · Top 7th in progress',
  )
  assert.equal(fillTokens('Live · {inning} in progress'), 'Live · in progress')
  assert.equal(fillTokens('now batting: {inning}', { inning: '$& $`' }), 'now batting: $& $`')
})

test('fillTokens fills both tokens together and honors each independently', () => {
  assert.equal(
    fillTokens('{inning}, sealing at {time}', { inning: 'Bottom 9th', time: '8:00 AM' }),
    'Bottom 9th, sealing at 8:00 AM',
  )
  // One provided, one not: the missing one is stripped and tidied, the provided
  // one is left exactly as given.
  assert.equal(fillTokens('{inning} until {time}', { inning: 'Top 1st' }), 'Top 1st until')
  assert.equal(fillTokens('{inning} until {time}', { time: '8:00 AM' }), 'until 8:00 AM')
})

// The closed-set guarantee: anything not in TOKENS is left alone, so editable
// copy can never trigger a substitution the registry hasn't sanctioned.
test('fillTokens ignores unregistered tokens entirely', () => {
  assert.deepEqual([...TOKENS], ['time', 'inning'])
  assert.equal(
    fillTokens('the score is {score}', { score: '4-2', time: '8:00 AM' }),
    'the score is {score}',
  )
})
