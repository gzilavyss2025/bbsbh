import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'

// public/data/umpires/{personId}.json — one shard per umpire, replacing the
// league-wide file that reached 3.2 MB by August. Every reader is after a single
// man (the detail page, and the accuracy modal one tap away on the lineup page),
// so the shard is what a visit costs. See scripts/gen-umpires.mjs.

const DIR = new URL('../public/data/umpires/', import.meta.url)
const shards = readdirSync(DIR).filter((f) => f.endsWith('.json'))

test('every shard is one umpire, self-describing, and named for his id', () => {
  assert.ok(shards.length > 50, `only ${shards.length} shards on file`)
  for (const f of shards) {
    const u = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'))
    // The filename IS the lookup key the app fetches by, so a mismatch is a
    // silent 404 on a real umpire.
    assert.equal(String(u.id), f.replace('.json', ''), `${f}: id does not match its name`)
    assert.ok(u.name, `${f}: no name`)
    assert.ok(Array.isArray(u.games) && u.games.length, `${f}: no games`)
    // Season + stamp ride along so a reader needs one fetch, not a shard plus
    // an index.
    assert.ok(u.season, `${f}: no season`)
    assert.ok(u.generatedAt, `${f}: no generatedAt`)
  }
})

test('a shard stays small enough to load on a tap', () => {
  // The point of the split. The league-wide file was 3.2 MB and grew all
  // season; a shard grows too, but only by one umpire's own games.
  const largest = Math.max(...shards.map((f) => statSync(new URL(f, DIR)).size))
  assert.ok(largest < 200 * 1024, `largest shard is ${Math.round(largest / 1024)} KB`)
})

test('every umpire with accuracy data has a shard to open', () => {
  // The detail page joins the two: aggregates from the accuracy summary, the
  // game log from the shard. An umpire in one file and not the other renders as
  // "no such umpire" on a link the app itself printed.
  const acc = JSON.parse(
    readFileSync(new URL('../umpire-accuracy-summary.json', DIR), 'utf8'),
  )
  const have = new Set(shards.map((f) => f.replace('.json', '')))
  const missing = Object.keys(acc.umpires).filter((id) => !have.has(id))
  assert.deepEqual(missing, [], 'umpires with accuracy but no assignment shard')
})
