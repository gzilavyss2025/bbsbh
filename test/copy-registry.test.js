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
import { BALLPARKS } from '../src/lib/ballpark/ballparkData.js'
import { CREDITS, creditLine, fieldIds, resolvePhoto, venueKey } from '../src/lib/ballpark/ballparkArt.js'
import MILB_BALLPARKS from '../src/lib/data/milb-ballparks.json' with { type: 'json' }

test('every field has a string default within its own maxLength', () => {
  for (const f of FIELDS) {
    assert.equal(typeof f.default, 'string', `${f.id} default is a string`)
    assert.ok(f.default.length <= f.maxLength, `${f.id} default fits its maxLength`)
  }
})

// The non-empty rule is REAL but it belongs to the fields the app renders
// unconditionally: a consent modal with a blank title or a blank accept button
// is a broken, unusable consent moment, so those defaults may never be empty.
// The ballpark notes are the deliberate other case — BallparkCard renders the
// paragraph only `&& note`, so an empty default means "no note yet", which is
// the correct shipped state for a park nobody has written about. Same story
// for every MiLB park field (`ballparksMilb`) — BallparkCard renders each of
// them only when the owner has set one. Splitting the assertion keeps the
// strong guarantee exactly where it protects something.
test('every unconditionally-rendered field has a non-empty default', () => {
  for (const f of FIELDS) {
    if (f.group === 'ballparks' || f.group === 'ballparksMilb') continue
    assert.ok(f.default.length > 0, `${f.id} default is non-empty`)
  }
})

test('every ballpark field ships empty, so no park carries content nobody chose', () => {
  const fields = FIELDS.filter((f) => f.group === 'ballparks')
  assert.ok(fields.length >= 180, 'every MLB park has its six fields')
  for (const f of fields) {
    assert.equal(f.default, '', `${f.id} ships empty`)
    assert.ok(f.subgroup, `${f.id} names the park it belongs to`)
  }
})

// The note ids are Redis field names. If BALLPARKS and the derived ids ever
// drifted — a park renamed, a key normalized differently — the paragraph an
// admin wrote would silently detach from the park it describes and the card
// would go blank with no error anywhere. Pin the derivation to its source.
test('every ballpark has exactly its six fields, keyed off its canonical name', () => {
  const parks = [...new Set(Object.values(BALLPARKS))]
  const expected = parks
    .flatMap((p) => {
      const k = venueKey(p.name)
      return [
        `ballpark.${k}`,
        `ballpark.${k}Name`,
        `ballpark.${k}Wordmark`,
        `ballpark.${k}Photo`,
        `ballpark.${k}Credit`,
        `ballpark.${k}Focus`,
      ]
    })
    .sort()
  const actual = FIELDS.filter((f) => f.group === 'ballparks')
    .map((f) => f.id)
    .sort()
  assert.deepEqual(actual, expected)
  // 33 BALLPARKS keys collapse to 30 parks: the three alias names share a
  // record, and must therefore share ONE set of fields, not carry two.
  assert.equal(actual.length, parks.length * 6)
  assert.ok(Object.keys(BALLPARKS).length > parks.length, 'alias keys exist to collapse')
})

// The MiLB counterpart — same photo/name/logo editor, minus the note (no
// diagram sits beside it to introduce, see milbParkFields()'s header) and
// minus any park a key collision hands to the MLB table instead (Sutter
// Health Park: both the Athletics' temporary MLB home and the Sacramento
// River Cats' Triple-A park).
test('every MiLB ballpark ships its five fields, empty, with no note', () => {
  const fields = FIELDS.filter((f) => f.group === 'ballparksMilb')
  const parkCount = Object.keys(MILB_BALLPARKS).filter((k) => !(k in BALLPARKS)).length
  assert.ok(parkCount > 100, 'the generated list carries a real MiLB-sized set')
  assert.equal(fields.length, parkCount * 5)
  for (const f of fields) {
    assert.equal(f.default, '', `${f.id} ships empty`)
    assert.ok(f.subgroup, `${f.id} names the park it belongs to`)
    assert.match(f.id, /^ballpark\.[a-z0-9]+(Name|Wordmark|Photo|Credit|Focus)$/, `${f.id} is a slot id, not a bare note`)
  }
})

test('a MiLB park already claimed by BALLPARKS (Sutter Health Park) keeps one set of fields, not two', () => {
  const key = venueKey('Sutter Health Park')
  assert.ok(key in BALLPARKS, 'sanity: this park really is in the MLB table')
  assert.ok(key in MILB_BALLPARKS, 'sanity: statsapi really does list it under a MiLB sportId too')
  const matches = FIELD_IDS.filter((id) => id.startsWith(`ballpark.${key}`))
  // Six MLB-shaped fields (note + five slots), zero from the MiLB group.
  assert.equal(matches.length, 6)
  assert.equal(FIELDS.find((f) => f.id === `ballpark.${key}Name`).group, 'ballparks')
})

test('fieldIds for a MiLB venue resolves to ids the registry actually knows', () => {
  const known = new Set(FIELD_IDS)
  const key = venueKey('Fifth Third Field')
  assert.ok(key in MILB_BALLPARKS, 'sanity: a real MiLB park from the generated list')
  for (const id of Object.values(fieldIds(key))) {
    assert.ok(known.has(id), `${id} is a real registry field`)
  }
  // No note field exists for a MiLB park.
  assert.ok(!known.has(`ballpark.${key}`))
})

// The photo URL becomes an `<img src>` and the focal point becomes a CSS
// `object-position`. Neither is prose, so "bounded string" stops being a
// sufficient contract — these are the first registry fields where the VALUE's
// shape is a safety property, enforced in sanitizeOverrides for the panel and
// api/copy.js alike.
test('photo-URL fields accept only an https URL', () => {
  const id = `ballpark.${venueKey('Fenway Park')}Photo`
  const keep = (v) => sanitizeOverrides({ [id]: v })[id]
  assert.equal(keep('https://example.com/fenway.jpg'), 'https://example.com/fenway.jpg')
  // Everything that is not a plain https URL is dropped, not stored-and-hoped.
  for (const bad of [
    'javascript:alert(1)',
    'http://example.com/x.jpg',
    'data:image/png;base64,AAAA',
    '//example.com/x.jpg',
    'https://example.com/a b.jpg',
    'https://example.com/x.jpg" onerror="alert(1)',
    'not a url at all',
  ]) {
    assert.equal(keep(bad), undefined, `${bad} is refused`)
  }
})

test('focal-point fields accept only two numbers 0-100', () => {
  const id = `ballpark.${venueKey('Fenway Park')}Focus`
  const keep = (v) => sanitizeOverrides({ [id]: v })[id]
  assert.equal(keep('50 50'), '50 50')
  assert.equal(keep('0 100'), '0 100')
  assert.equal(keep('100 0'), '100 0')
  for (const bad of ['101 50', '50 101', '50', '50,50', '-1 50', 'center', '50 50; color:red']) {
    assert.equal(keep(bad), undefined, `${bad} is refused`)
  }
})

// The note and credit are ordinary prose and must NOT have inherited a pattern
// — a rule that silently ate an apostrophe would be worse than no rule.
test('prose ballpark fields stay unpatterned', () => {
  const k = venueKey('Fenway Park')
  for (const id of [`ballpark.${k}`, `ballpark.${k}Credit`]) {
    const field = FIELDS.find((f) => f.id === id)
    assert.equal(field.pattern, undefined, `${id} is prose, not a pattern`)
  }
  const text = "The Green Monster's 37 feet — still the loudest wall in baseball."
  assert.equal(sanitizeOverrides({ [`ballpark.${k}`]: text })[`ballpark.${k}`], text)
})

// A note that has no photo beside it renders a lopsided hero row, and a photo
// with no CREDITS entry would put the app out of CC BY-SA compliance. Both
// tables are keyed the same way, so pin them to each other.
test('every ballpark has a credited photo on file', () => {
  for (const park of new Set(Object.values(BALLPARKS))) {
    const key = venueKey(park.name)
    const credit = CREDITS[key]
    assert.ok(credit, `${park.name} has a photo credit`)
    assert.ok(credit.artist, `${park.name} names its photographer`)
    assert.ok(credit.license, `${park.name} states its licence`)
    assert.ok(credit.source.startsWith('https://'), `${park.name} links its source`)
  }
})

test('resolvePhoto falls back to the bundled photo, credited and linked', () => {
  const p = resolvePhoto('Fenway Park')
  assert.equal(p.src, '/ballparks/fenwaypark.jpg')
  assert.equal(p.isOverride, false)
  assert.equal(p.focus, '50% 50%', 'no focal point set means dead centre')
  assert.match(p.creditText, /Rick Berry/)
  assert.ok(p.creditHref.startsWith('https://commons.wikimedia.org/'))
  assert.equal(resolvePhoto('Some MiLB Yard'), null)
})

// The reason an override drops the bundled credit rather than inheriting it:
// leaving the Commons photographer's name and licence attached to somebody
// else's photograph misattributes BOTH images at once. Losing a credit is a
// smaller wrong than printing a false one.
test('an override replaces the photo AND its credit, never inheriting the old one', () => {
  const p = resolvePhoto('Fenway Park', { photo: 'https://example.com/mine.jpg' })
  assert.equal(p.src, 'https://example.com/mine.jpg')
  assert.equal(p.isOverride, true)
  assert.equal(p.creditText, '', 'the bundled credit does not carry over')
  assert.equal(p.creditHref, null, 'and neither does its Commons link')

  const credited = resolvePhoto('Fenway Park', {
    photo: 'https://example.com/mine.jpg',
    credit: 'Photo: G. Zilavy',
  })
  assert.equal(credited.creditText, 'Photo: G. Zilavy')
  assert.equal(credited.creditHref, null)
})

test('the focal point becomes a CSS object-position, on bundled and override alike', () => {
  assert.equal(resolvePhoto('Fenway Park', { focus: '50 20' }).focus, '50% 20%')
  assert.equal(resolvePhoto('Fenway Park', { focus: '0 100' }).focus, '0% 100%')
  assert.equal(
    resolvePhoto('Fenway Park', { photo: 'https://example.com/m.jpg', focus: '75 10' }).focus,
    '75% 10%',
  )
  // A value the registry would never have stored still cannot emit broken CSS.
  assert.equal(resolvePhoto('Fenway Park', { focus: 'garbage' }).focus, '50% 50%')
})

// creditLine is what actually satisfies the licence on screen. A CC BY / CC
// BY-SA photo must name BOTH the author and the licence; public-domain and CC0
// owe nothing, so they name the photographer only, as a courtesy.
test('creditLine names the licence for every photo that requires it', () => {
  assert.equal(
    creditLine({ artist: 'Chris6d', license: 'CC BY-SA 4.0' }),
    'Photo: Chris6d · CC BY-SA 4.0',
  )
  assert.equal(creditLine({ artist: 'Jeffme', license: 'CC0' }), 'Photo: Jeffme')
  assert.equal(creditLine({ artist: 'Rick Berry', license: 'Public domain' }), 'Photo: Rick Berry')
  assert.equal(creditLine(null), '')
  for (const [key, credit] of Object.entries(CREDITS)) {
    const line = creditLine(credit)
    assert.ok(line.includes(credit.artist), `${key} credits its photographer on screen`)
    const free = credit.license === 'CC0' || credit.license === 'Public domain'
    assert.equal(line.includes(credit.license), !free, `${key} states its licence when obliged`)
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
    // The slot half allows digits — venueKey() emits [a-z0-9], and a real MiLB
    // venue name can carry one ("7 17 Credit Union Park" -> "717creditunion...").
    //
    // Landing-page slots are DEEPER: `learn.{slug}.{sectionId}.{slot}`, because a
    // guide's text is addressed by which page and which section it belongs to
    // (see src/copy/landing/schema.js). Their slug and section ids are kebab-case,
    // so hyphens are legal in those segments and nowhere else.
    //
    // What this assertion is actually protecting is unchanged, and it is the part
    // worth stating: an id BEGINS with its group and every segment is a safe Redis
    // field name. That is what keeps `sanitizeOverrides` able to bound the key
    // space, and what keeps two different slots from colliding on one stored
    // field — a collision whose failure mode is silent, because the losing slot
    // just renders its shipped default forever.
    const shape = id.startsWith('learn.')
      ? /^learn(\.[a-z0-9-]+){2}\.[a-zA-Z0-9]+$/
      : /^[a-zA-Z]+\.[a-zA-Z0-9]+$/
    assert.match(id, shape, `${id} is a well-formed group-prefixed slot id`)
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
