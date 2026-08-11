// Unit coverage for editing a ballpark in place — the gear on the Overview's
// Ballpark card (screens/team/modules/ballpark/) and the endpoint behind it.
//
// Three properties are pinned here, and each one is pinned because getting it
// wrong is quiet rather than loud:
//
//   1. A PARTIAL SAVE MUST NOT DELETE THE REST. POST /api/copy takes the full
//      override map and hdels every key the body omits. An editor that holds six
//      fields and posts six fields would wipe the consent copy and 29 other
//      parks, and the app would keep rendering perfectly on shipped defaults —
//      nothing would look broken. mergeOverrides is the only thing standing
//      between those two outcomes.
//   2. THE NEW FIELDS RESOLVE IN THE RIGHT ORDER. A wordmark override has to beat
//      a bundled LOGO_KEYS entry, and a text override has to beat the feed's
//      park name, without either forcing the other.
//   3. THE UPLOAD ENDPOINT SNIFFS AND SCOPES. It accepts only real JPEG/PNG
//      bytes, only for a park the registry knows, and only deletes blobs in our
//      own store.
import assert from 'node:assert/strict'
import test from 'node:test'
import { FIELD_IDS, mergeOverrides } from '../src/copy/registry.js'
import { resolveParkName, venueKey } from '../src/lib/ballpark/ballparkArt.js'
import { fieldIds } from '../src/screens/team/modules/ballpark/useBallparkDraft.js'
import { isOwnBlobUrl, sniffImage } from '../api/ballpark-photo.js'

const FENWAY = venueKey('Fenway Park')

// --------------------------------------------------------------------------
// 1. The merge — the one that prevents silent, total copy loss
// --------------------------------------------------------------------------

test('a partial save leaves every field it does not name exactly as it was', () => {
  const current = {
    'scoresUnlocked.title': 'Sure you want the scores?',
    'stampIn.confirm': 'Show me the season',
    [`ballpark.${venueKey('Wrigley Field')}`]: 'The ivy is real.',
    [`ballpark.${FENWAY}Photo`]: 'https://example.com/old.jpg',
  }
  const merged = mergeOverrides(current, { [`ballpark.${FENWAY}Name`]: 'The Fens' })

  assert.equal(merged['scoresUnlocked.title'], 'Sure you want the scores?')
  assert.equal(merged['stampIn.confirm'], 'Show me the season')
  assert.equal(merged[`ballpark.${venueKey('Wrigley Field')}`], 'The ivy is real.')
  assert.equal(merged[`ballpark.${FENWAY}Photo`], 'https://example.com/old.jpg')
  assert.equal(merged[`ballpark.${FENWAY}Name`], 'The Fens')
})

test('an empty patch value clears that one field and only that one', () => {
  const current = {
    [`ballpark.${FENWAY}Name`]: 'The Fens',
    [`ballpark.${FENWAY}Credit`]: 'Photo: G. Zilavy',
    'scoresUnlocked.title': 'Sure you want the scores?',
  }
  const merged = mergeOverrides(current, { [`ballpark.${FENWAY}Name`]: '' })

  assert.ok(!(`ballpark.${FENWAY}Name` in merged), 'the cleared field is gone, not stored empty')
  assert.equal(merged[`ballpark.${FENWAY}Credit`], 'Photo: G. Zilavy')
  assert.equal(merged['scoresUnlocked.title'], 'Sure you want the scores?')
})

test('a whitespace-only patch value clears rather than storing a blank', () => {
  const merged = mergeOverrides({ [`ballpark.${FENWAY}Name`]: 'The Fens' }, {
    [`ballpark.${FENWAY}Name`]: '   ',
  })
  assert.deepEqual(merged, {})
})

test('the merge still runs everything through the registry choke point', () => {
  // An unknown id and an over-length value both have to die here, not just at
  // the server — the merged map is what gets POSTed, and a value the server
  // silently drops would leave the editor reporting a save that did not happen.
  const merged = mergeOverrides(
    { 'ballpark.nosuchpark': 'x', 'scoresUnlocked.title': 'kept' },
    { [`ballpark.${FENWAY}Name`]: 'x'.repeat(500) },
  )
  assert.deepEqual(merged, { 'scoresUnlocked.title': 'kept' })
})

test('a javascript: URL cannot reach the wordmark field through the merge', () => {
  // Assembled rather than written literally so no linter has to decide whether
  // a test fixture counts as a script URL in source.
  const scheme = ['java', 'script:'].join('')
  const merged = mergeOverrides({}, { [`ballpark.${FENWAY}Wordmark`]: `${scheme}alert(1)` })
  assert.deepEqual(merged, {}, 'the https-only pattern rejects it')
})

// --------------------------------------------------------------------------
// 2. Naming — text override, image override, and their precedence
// --------------------------------------------------------------------------

test('with no overrides a park is named by the feed, as text', () => {
  const name = resolveParkName('Fenway Park')
  assert.equal(name.text, 'Fenway Park')
  assert.equal(name.wordmark, null)
})

test('a typed name replaces the feed name', () => {
  assert.equal(resolveParkName('Fenway Park', { name: 'The Fens' }).text, 'The Fens')
})

test('a wordmark keeps a readable name behind it, for alt text and a failed load', () => {
  const name = resolveParkName('Fenway Park', { wordmark: 'https://example.com/fenway.png' })
  assert.equal(name.wordmark, 'https://example.com/fenway.png')
  assert.equal(name.text, 'Fenway Park', 'the image is not allowed to erase the name')
})

test('the two overrides are independent — a wordmark does not require retyping the name', () => {
  const both = resolveParkName('Fenway Park', {
    name: 'The Fens',
    wordmark: 'https://example.com/fenway.png',
  })
  assert.equal(both.text, 'The Fens')
  assert.equal(both.wordmark, 'https://example.com/fenway.png')
})

test('an unknown park still resolves to something renderable', () => {
  assert.deepEqual(resolveParkName('Some MiLB Yard'), { text: 'Some MiLB Yard', wordmark: null })
  assert.deepEqual(resolveParkName(undefined), { text: '', wordmark: null })
})

// --------------------------------------------------------------------------
// 3. The endpoint's pure guards
// --------------------------------------------------------------------------

test('sniffImage accepts real JPEG and PNG headers and nothing else', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(sniffImage(jpeg)?.ext, 'jpg')
  assert.equal(sniffImage(png)?.ext, 'png')
  assert.equal(sniffImage(png)?.contentType, 'image/png')
})

test('sniffImage rejects a file that only CLAIMS to be an image', () => {
  // An SVG is the one that matters: it is an image to a human and a document
  // with script in it to a browser, and content-type alone would have let it in.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
  assert.equal(sniffImage(svg), null)
  assert.equal(sniffImage(new Uint8Array([0, 1, 2])), null, 'too short to have a header')
  assert.equal(sniffImage(null), null)
})

test('isOwnBlobUrl only ever admits our own store over https', () => {
  assert.ok(isOwnBlobUrl('https://abc123.public.blob.vercel-storage.com/ballparks/fenwaypark-photo-x.jpg'))
  assert.equal(isOwnBlobUrl('https://example.com/photo.jpg'), false)
  assert.equal(isOwnBlobUrl('http://abc.public.blob.vercel-storage.com/x.jpg'), false, 'https only')
  assert.equal(
    isOwnBlobUrl('https://evil.com/?x=.public.blob.vercel-storage.com'),
    false,
    'the host is checked, not the string',
  )
  assert.equal(isOwnBlobUrl(''), false)
  assert.equal(isOwnBlobUrl(null), false)
})

// --------------------------------------------------------------------------
// The seam between the draft's short slot names and the registry's dotted ids
// --------------------------------------------------------------------------

test('fieldIds builds ids the registry actually knows, with capitalised suffixes', () => {
  const known = new Set(FIELD_IDS)
  for (const id of Object.values(fieldIds(FENWAY))) {
    assert.ok(known.has(id), `${id} is a real registry field`)
    // Structural, not luck: venueKey emits [a-z0-9] only, so no park key can
    // ever contain the capital letter every suffix starts with, and a suffixed
    // id therefore cannot collide with some other park's bare note id. If
    // somebody lower-cases a suffix, this fails and registry.js says why.
    const suffix = id.slice(`ballpark.${FENWAY}`.length)
    assert.match(suffix, /^[A-Z]/, `${id} keeps its capitalised suffix`)
  }
})
