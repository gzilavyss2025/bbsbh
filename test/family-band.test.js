import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { familyBand, orderFamily } from '../src/api/person/family/family.js'
import { shardKey100 } from '../src/lib/shardKey.js'

// The "Family in baseball" band on the History tab: parents first, then
// brothers, then sons, then everyone else. A relative with no MLBAM id is a
// name with no link. A player with no entries draws nothing at all.

const entry = (relation, name, personId = 1) => ({ relation, name, personId })

test('orderFamily puts parents, brothers and sons first, the rest after, ties in file order', () => {
  const rows = [
    entry('Cousin', 'Cy'),
    entry('Son', 'Sam'),
    entry('Uncle', 'Uma'),
    entry('Brother', 'Bo'),
    entry('Step Father', 'Stan'),
    entry('Father', 'Fred'),
    entry('Half Brother', 'Hal'),
    entry('Step Son', 'Sid'),
  ]
  assert.deepEqual(
    orderFamily(rows).map((r) => r.name),
    ['Stan', 'Fred', 'Bo', 'Hal', 'Sam', 'Sid', 'Cy', 'Uma'],
  )
  assert.equal(rows[0].name, 'Cy', 'the input is not mutated')
})

test('familyBand reads the shard once and returns the entries with the credit lines', async () => {
  const shard = {
    credit: ['Retrosheet credit.', 'Chadwick credit.'],
    players: { 111188: [entry('Son', 'Barry', 7), entry('Father', 'Bobby', 8)] },
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) =>
    String(url).endsWith(`/${shardKey100(111188)}.json`)
      ? new Response(JSON.stringify(shard))
      : new Response('', { status: 404 })
  try {
    const band = await familyBand(111188)
    assert.deepEqual(band.credit, shard.credit)
    assert.deepEqual(band.entries.map((r) => r.name), ['Bobby', 'Barry'])
    assert.equal(await familyBand(999999), null, 'no shard: no band')
    assert.equal(await familyBand(null), null)
  } finally {
    globalThis.fetch = realFetch
  }
})

// The repo's unit suite runs under plain node, which cannot load .jsx, so the
// component's three rules are pinned on its source; the browser check draws it.
const src = readFileSync(new URL('../src/components/player/family/FamilyBand.jsx', import.meta.url), 'utf8')

test('FamilyBand draws nothing for no entries, and has no SealBox', () => {
  assert.match(src, /if \(!entries\?\.length\) return null/)
  assert.doesNotMatch(src, /SealBox/)
})

test('every relative goes through PlayerLink, which draws a name with no link for a null id', () => {
  assert.match(src, /<PlayerLink id=\{e\.personId\} name=\{e\.name\}/)
  assert.match(src, /<Pill>\{e\.relation\}<\/Pill>/)
  assert.match(src, /Family in baseball/)
})

test('the credit lines print as the prospect card prints its credits', () => {
  assert.match(src, /className="prankhist__credit"/)
})
